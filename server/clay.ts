import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { contacts, accounts } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { maybeNotifyHotLead } from "./integrations/connectors";
import { timingSafeEqual } from "./_core/security";

/**
 * Clay webhook router
 * Receives data from Clay tables via Zapier webhooks
 * SECURITY: Webhook endpoints now require a secret token for verification
 */

// Webhook secret for Clay - should be set in environment variables
const CLAY_WEBHOOK_SECRET = process.env.CLAY_WEBHOOK_SECRET || '';

// Schema for account webhook data from Clay
const clayAccountSchema = z.object({
  webhook_secret: z.string().optional(),
  clayId: z.string().optional(),
  name: z.string(),
  domain: z.string().optional(),
  region: z.string().optional(),
  industry: z.string().optional(),
  employees: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  intentScore: z.string().optional(),
  fitScore: z.string().optional(),
  relationship: z.enum(["Prospect", "Customer", "Partner", "POV"]).optional(),
  territory: z.enum(["Central", "West", "East", "Intl"]).optional(),
  segment: z.enum(["Commercial", "Enterprise"]).optional(),
  stack: z.string().optional(), // JSON string
  research: z.string().optional(),
  trigger: z.string().optional(),
  rawData: z.any().optional(), // Store full Clay payload
});

// Schema for contact webhook data from Clay
const clayContactSchema = z.object({
  webhook_secret: z.string().optional(),
  clayId: z.string().optional(),
  name: z.string(),
  title: z.string().optional(),
  email: z.string().optional(),
  linkedin: z.string().optional(),
  location: z.string().optional(),
  company: z.string(),
  rawData: z.any().optional(), // Store full Clay payload
});

// Helper function to verify webhook secret.
// Fails CLOSED: outside demo mode, an unset CLAY_WEBHOOK_SECRET rejects all requests
// so a production deploy can never expose an unauthenticated write endpoint by omission.
function verifyWebhookSecret(providedSecret: string | undefined): void {
  if (!CLAY_WEBHOOK_SECRET) {
    if (process.env.DEMO_MODE === 'true') return; // demo: open for local testing only
    console.error('[Clay Webhook] CLAY_WEBHOOK_SECRET not configured — rejecting request');
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Clay webhook is not configured (set CLAY_WEBHOOK_SECRET)'
    });
  }
  if (!timingSafeEqual(CLAY_WEBHOOK_SECRET, providedSecret)) {
    console.error('[Clay Webhook] Invalid webhook secret');
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid webhook secret'
    });
  }
}

export const clayRouter = router({
  /**
   * Webhook endpoint for Clay accounts table
   * POST /api/trpc/clay.receiveAccount
   * SECURITY: Requires webhook_secret in payload
   */
  receiveAccount: publicProcedure
    .input(clayAccountSchema)
    .mutation(async ({ input }) => {
      // SECURITY: Verify webhook secret
      verifyWebhookSecret(input.webhook_secret);
      
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // Convert rawData to JSON string if present
        const rawDataString = input.rawData ? JSON.stringify(input.rawData) : null;

        // Check if account exists by clayId or domain
        let existingAccount = null;
        if (input.clayId) {
          const result = await db
            .select()
            .from(accounts)
            .where(eq(accounts.clayRecordId, input.clayId))
            .limit(1);
          existingAccount = result[0];
        } else if (input.domain) {
          const result = await db
            .select()
            .from(accounts)
            .where(eq(accounts.domain, input.domain))
            .limit(1);
          existingAccount = result[0];
        }

        if (existingAccount) {
          // Update existing account
          await db
            .update(accounts)
            .set({
              name: input.name,
              domain: input.domain || existingAccount.domain,
              region: input.region || existingAccount.region,
              industry: input.industry || existingAccount.industry,
              employeeCount: input.employees ? parseInt(String(input.employees)) : existingAccount.employeeCount,
              description: input.description || existingAccount.description,
              website: input.url || existingAccount.website,
              intentScore: input.intentScore ? parseInt(String(input.intentScore)) : existingAccount.intentScore,
              relationship: input.relationship || existingAccount.relationship,
              techStack: input.stack || existingAccount.techStack,
              triggerEvents: input.trigger || existingAccount.triggerEvents,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, existingAccount.id));

          // Auto-notify if this update pushed the account across the hot-lead threshold.
          maybeNotifyHotLead(
            input.name,
            input.intentScore ? parseInt(String(input.intentScore)) : existingAccount.intentScore,
            existingAccount.intentScore,
          );

          return {
            success: true,
            action: "updated",
            accountId: existingAccount.id,
          };
        } else {
          // Insert new account
          await db.insert(accounts).values({
            clayRecordId: input.clayId || null,
            name: input.name,
            domain: input.domain || null,
            region: input.region || null,
            industry: input.industry || null,
            employeeCount: input.employees ? parseInt(String(input.employees)) : null,
            description: input.description || null,
            website: input.url || null,
            intentScore: input.intentScore ? parseInt(String(input.intentScore)) : null,
            relationship: input.relationship || "Prospect",
            techStack: input.stack || null,
            triggerEvents: input.trigger || null,
          });

          // Auto-notify if the new account arrives already hot.
          maybeNotifyHotLead(input.name, input.intentScore ? parseInt(String(input.intentScore)) : null, 0);

          return {
            success: true,
            action: "created",
          };
        }
      } catch (error) {
        console.error("[Clay Webhook] Error processing account:", error);
        throw new Error(`Failed to process account: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),

  /**
   * Webhook endpoint for Clay contacts table
   * POST /api/trpc/clay.receiveContact
   * SECURITY: Requires webhook_secret in payload
   */
  receiveContact: publicProcedure
    .input(clayContactSchema)
    .mutation(async ({ input }) => {
      // SECURITY: Verify webhook secret
      verifyWebhookSecret(input.webhook_secret);
      
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // Convert rawData to JSON string if present
        const rawDataString = input.rawData ? JSON.stringify(input.rawData) : null;

        // Check if contact exists by clayId or email
        let existingContact = null;
        if (input.clayId) {
          const result = await db
            .select()
            .from(contacts)
            .where(eq(contacts.clayRecordId, input.clayId))
            .limit(1);
          existingContact = result[0];
        } else if (input.email) {
          const result = await db
            .select()
            .from(contacts)
            .where(eq(contacts.email, input.email))
            .limit(1);
          existingContact = result[0];
        }

        if (existingContact) {
          // Update existing contact
          await db
            .update(contacts)
            .set({
              name: input.name,
              title: input.title || existingContact.title,
              email: input.email || existingContact.email,
              linkedinUrl: input.linkedin || existingContact.linkedinUrl,
              location: input.location || existingContact.location,
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, existingContact.id));

          return {
            success: true,
            action: "updated",
            contactId: existingContact.id,
          };
        } else {
          // Resolve the contact's account by company name (creating a stub account when the
          // company isn't known yet) so contacts are never orphaned under a non-existent
          // account 0. accountId is nullable, so a failed resolution falls back to null.
          let accountId: number | null = null;
          if (input.company) {
            const existingAccount = await db
              .select({ id: accounts.id })
              .from(accounts)
              .where(eq(accounts.name, input.company))
              .limit(1);
            if (existingAccount[0]) {
              accountId = existingAccount[0].id;
            } else {
              const domain = input.email?.includes("@") ? input.email.split("@")[1] : null;
              const inserted: any = await db.insert(accounts).values({
                name: input.company,
                domain: domain || null,
              });
              // Drizzle returns insertId on MySQL; the demo shim returns the row.
              accountId = inserted?.insertId ?? inserted?.[0]?.insertId ?? null;
              if (accountId == null) {
                const created = await db.select({ id: accounts.id }).from(accounts)
                  .where(eq(accounts.name, input.company)).limit(1);
                accountId = created[0]?.id ?? null;
              }
            }
          }

          await db.insert(contacts).values({
            clayRecordId: input.clayId || null,
            name: input.name,
            title: input.title || null,
            email: input.email || null,
            linkedinUrl: input.linkedin || null,
            location: input.location || null,
            accountId,
          });

          return {
            success: true,
            action: "created",
            accountId,
          };
        }
      } catch (error) {
        console.error("[Clay Webhook] Error processing contact:", error);
        throw new Error(`Failed to process contact: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),

  /**
   * Test endpoint to verify webhook connectivity
   * SECURITY: Now requires authentication
   */
  ping: protectedProcedure.query(() => {
    return {
      success: true,
      message: "Clay webhook endpoint is active",
      timestamp: new Date().toISOString(),
      webhookSecretConfigured: !!CLAY_WEBHOOK_SECRET,
    };
  }),
});
