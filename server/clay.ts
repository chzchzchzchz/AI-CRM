import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { contacts, accounts } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Clay webhook router
 * Receives data from Clay tables via Zapier webhooks
 */

// Schema for account webhook data from Clay
const clayAccountSchema = z.object({
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
  clayId: z.string().optional(),
  name: z.string(),
  title: z.string().optional(),
  email: z.string().optional(),
  linkedin: z.string().optional(),
  location: z.string().optional(),
  company: z.string(),
  rawData: z.any().optional(), // Store full Clay payload
});

export const clayRouter = router({
  /**
   * Webhook endpoint for Clay accounts table
   * POST /api/trpc/clay.receiveAccount
   */
  receiveAccount: publicProcedure
    .input(clayAccountSchema)
    .mutation(async ({ input }) => {
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
            .where(eq(accounts.clayId, input.clayId))
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
              employees: input.employees || existingAccount.employees,
              description: input.description || existingAccount.description,
              url: input.url || existingAccount.url,
              intentScore: input.intentScore || existingAccount.intentScore,
              fitScore: input.fitScore || existingAccount.fitScore,
              relationship: input.relationship || existingAccount.relationship,
              territory: input.territory || existingAccount.territory,
              segment: input.segment || existingAccount.segment,
              stack: input.stack || existingAccount.stack,
              research: input.research || existingAccount.research,
              trigger: input.trigger || existingAccount.trigger,
              rawData: rawDataString || existingAccount.rawData,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, existingAccount.id));

          return {
            success: true,
            action: "updated",
            accountId: existingAccount.id,
          };
        } else {
          // Insert new account
          await db.insert(accounts).values({
            clayId: input.clayId || null,
            name: input.name,
            domain: input.domain || null,
            region: input.region || null,
            industry: input.industry || null,
            employees: input.employees || null,
            description: input.description || null,
            url: input.url || null,
            intentScore: input.intentScore || null,
            fitScore: input.fitScore || null,
            relationship: input.relationship || "Prospect",
            territory: input.territory || null,
            segment: input.segment || "Commercial",
            stack: input.stack || null,
            research: input.research || null,
            trigger: input.trigger || null,
            rawData: rawDataString,
          });

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
   */
  receiveContact: publicProcedure
    .input(clayContactSchema)
    .mutation(async ({ input }) => {
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
          // Insert new contact
          await db.insert(contacts).values({
            clayRecordId: input.clayId || null,
            name: input.name,
            title: input.title || null,
            email: input.email || null,
            linkedinUrl: input.linkedin || null,
            location: input.location || null,
            accountId: 0, // TODO: Need to match company to account
          });

          return {
            success: true,
            action: "created",
          };
        }
      } catch (error) {
        console.error("[Clay Webhook] Error processing contact:", error);
        throw new Error(`Failed to process contact: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),

  /**
   * Test endpoint to verify webhook connectivity
   */
  ping: publicProcedure.query(() => {
    return {
      success: true,
      message: "Clay webhook endpoint is active",
      timestamp: new Date().toISOString(),
    };
  }),
});
