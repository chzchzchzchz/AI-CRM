import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { accounts } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Webhook secret for Clay - should be set in environment variables
const CLAY_WEBHOOK_SECRET = process.env.CLAY_WEBHOOK_SECRET || '';

/**
 * Clay Webhook Router
 * 
 * Receives enriched data pushed from Clay via HTTP API integration
 * SECURITY: Webhook endpoints now require a secret token for verification
 */

export const clayWebhookRouter = router({
  /**
   * Webhook endpoint to receive enriched account data from Clay
   * 
   * Clay will POST to this endpoint with enriched data
   * SECURITY: Requires webhook_secret in payload for verification
   */
  receive: publicProcedure
    .input(z.object({
      webhook_secret: z.string().optional(),
      // Accept any additional payload structure from Clay
    }).passthrough())
    .mutation(async ({ input }) => {
      // SECURITY: fail CLOSED — outside demo mode an unset secret rejects all requests,
      // so this write endpoint can never be left unauthenticated by omission.
      if (!CLAY_WEBHOOK_SECRET) {
        if (process.env.DEMO_MODE !== 'true') {
          console.error('[Clay Webhook] CLAY_WEBHOOK_SECRET not configured — rejecting request');
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clay webhook is not configured (set CLAY_WEBHOOK_SECRET)'
          });
        }
      } else if (input.webhook_secret !== CLAY_WEBHOOK_SECRET) {
        console.error('[Clay Webhook] Invalid webhook secret');
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid webhook secret'
        });
      }

      // Remove webhook_secret from payload before processing
      const { webhook_secret, ...payload } = input;
      
      console.log('[Clay Webhook] Received authenticated payload:', JSON.stringify(payload, null, 2));
      
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // Extract account data from Clay payload
        // Clay sends data in various formats, so we need to be flexible
        const data = payload as Record<string, any>;
        
        // Try to find domain/company identifiers
        const domain = 
          data.domain || 
          data.website || 
          data.company_domain ||
          data.Domain ||
          data.Website ||
          data['Company Domain'] ||
          null;
        
        const name = 
          data.name || 
          data.company ||
          data.company_name ||
          data.Name ||
          data.Company ||
          data['Company Name'] ||
          domain;

        if (!domain && !name) {
          console.error('[Clay Webhook] No domain or name found in payload');
          return {
            success: false,
            error: 'No domain or company name found in payload'
          };
        }

        // Separate enrichment data into categories
        const stack: Record<string, any> = {};
        const research: Record<string, any> = {};
        const trigger: Record<string, any> = {};
        const rawData: Record<string, any> = {};

        // Categorize fields based on keywords
        for (const [key, value] of Object.entries(data)) {
          const keyLower = key.toLowerCase();
          
          // Skip system fields
          if (keyLower === 'domain' || keyLower === 'name' || keyLower === 'website' || 
              keyLower === 'company' || keyLower === 'company_name' || keyLower === 'company_domain') {
            continue;
          }

          // Categorize based on field name
          if (keyLower.includes('tech') || keyLower.includes('stack') || keyLower.includes('tool')) {
            stack[key] = value;
          } else if (keyLower.includes('research') || keyLower.includes('insight') || 
                     keyLower.includes('security') || keyLower.includes('incident') ||
                     keyLower.includes('job') || keyLower.includes('decision') ||
                     keyLower.includes('employee') || keyLower.includes('headcount')) {
            research[key] = value;
          } else if (keyLower.includes('trigger') || keyLower.includes('signal') || 
                     keyLower.includes('buying') || keyLower.includes('intent')) {
            trigger[key] = value;
          } else {
            rawData[key] = value;
          }
        }

        // Clean domain (remove protocol and trailing slash)
        const cleanDomain = domain 
          ? String(domain).replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
          : null;

        // Check if account already exists
        let existing = null;
        if (cleanDomain) {
          const results = await db
            .select()
            .from(accounts)
            .where(eq(accounts.domain, cleanDomain))
            .limit(1);
          existing = results.length > 0 ? results[0] : null;
        }

        // Map the categorized enrichment onto the REAL account columns. The previous version
        // wrote `stack`/`research`/`trigger`, none of which are columns on the accounts
        // table (they are techStack / triggerEvents / aiResearchCache / rawData), so every
        // Clay enrichment was silently dropped.
        const accountData: Record<string, any> = {
          name: name || cleanDomain || 'Unknown',
          domain: cleanDomain || name || 'unknown',
          techStack: Object.keys(stack).length > 0 ? JSON.stringify(stack) : null,
          triggerEvents: Object.keys(trigger).length > 0 ? JSON.stringify(trigger) : null,
          aiResearchCache: Object.keys(research).length > 0 ? JSON.stringify(research) : null,
          rawData: Object.keys(rawData).length > 0 ? rawData : null,
        };
        // Never overwrite existing values with null when Clay sent nothing for that field.
        for (const k of Object.keys(accountData)) {
          if (accountData[k] === null) delete accountData[k];
        }

        if (existing) {
          // Update existing account
          await db
            .update(accounts)
            .set(accountData)
            .where(eq(accounts.id, existing.id));
          
          console.log(`[Clay Webhook] Updated account: ${accountData.domain}`);
          
          return {
            success: true,
            action: 'updated',
            accountId: existing.id,
            domain: accountData.domain
          };
        } else {
          // Insert new account
          await db.insert(accounts).values(accountData);
          
          console.log(`[Clay Webhook] Created account: ${accountData.domain}`);
          
          return {
            success: true,
            action: 'created',
            domain: accountData.domain
          };
        }
      } catch (error) {
        console.error('[Clay Webhook] Error processing payload:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Test endpoint to verify webhook is working
   * SECURITY: Now requires authentication
   */
  test: protectedProcedure
    .query(() => {
      return {
        status: 'ok',
        message: 'Clay webhook endpoint is ready to receive data',
        timestamp: new Date().toISOString(),
        webhookSecretConfigured: !!CLAY_WEBHOOK_SECRET
      };
    }),
});
