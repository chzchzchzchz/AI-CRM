import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { accounts } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { parseUniversalData, mapToAccountSchema } from "./universal-parser";

/**
 * Clay Data Import Router
 * 
 * This handles importing enrichment data from Clay with full JSON fields
 */

export const clayImportRouter = router({
  /**
   * Import raw pasted data (CSV, TSV, JSON, Excel paste)
   */
  importRawData: protectedProcedure
    .input(z.object({
      rawData: z.string()
    }))
    .mutation(async ({ input }) => {
      // Parse the raw data
      const parsed = parseUniversalData(input.rawData);
      const accountsData = mapToAccountSchema(parsed);
      
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let imported = 0;
      let updated = 0;
      let errors = 0;

      for (const account of accountsData) {
        try {
          if (!account.domain) {
            errors++;
            continue;
          }

          // Check if account exists
          const existing = await db
            .select()
            .from(accounts)
            .where(eq(accounts.domain, account.domain))
            .limit(1);

          const accountData = {
            name: account.name || account.domain,
            domain: account.domain,
            stack: Object.keys(account.stack || {}).length > 0 ? JSON.stringify(account.stack) : null,
            research: Object.keys(account.research || {}).length > 0 ? JSON.stringify(account.research) : null,
            trigger: Object.keys(account.trigger || {}).length > 0 ? JSON.stringify(account.trigger) : null,
            rawData: Object.keys(account.rawData || {}).length > 0 ? JSON.stringify(account.rawData) : null,
          };

          if (existing.length > 0) {
            // Update existing account
            await db
              .update(accounts)
              .set(accountData)
              .where(eq(accounts.id, existing[0].id));
            updated++;
          } else {
            // Insert new account
            await db.insert(accounts).values(accountData);
            imported++;
          }
        } catch (error) {
          console.error(`Error importing account ${account.domain}:`, error);
          errors++;
        }
      }

      return {
        success: true,
        imported,
        updated,
        errors,
        total: accountsData.length,
      };
    }),

  /**
   * Import accounts from Clay with full enrichment data (JSON format)
   */
  importAccounts: protectedProcedure
    .input(z.object({
      accounts: z.array(z.object({
        name: z.string(),
        domain: z.string(),
        stack: z.record(z.string(), z.any()).optional(),
        research: z.record(z.string(), z.any()).optional(),
        trigger: z.record(z.string(), z.any()).optional(),
        rawData: z.record(z.string(), z.any()).optional(),
      }))
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let imported = 0;
      let updated = 0;
      let errors = 0;

      for (const account of input.accounts) {
        try {
          // Check if account exists
          const existing = await db
            .select()
            .from(accounts)
            .where(eq(accounts.domain, account.domain))
            .limit(1);

          const accountData = {
            name: account.name,
            domain: account.domain,
            stack: account.stack ? JSON.stringify(account.stack) : null,
            research: account.research ? JSON.stringify(account.research) : null,
            trigger: account.trigger ? JSON.stringify(account.trigger) : null,
            rawData: account.rawData ? JSON.stringify(account.rawData) : null,
          };

          if (existing.length > 0) {
            // Update existing account
            await db
              .update(accounts)
              .set(accountData)
              .where(eq(accounts.id, existing[0].id));
            updated++;
          } else {
            // Insert new account
            await db.insert(accounts).values(accountData);
            imported++;
          }
        } catch (error) {
          console.error(`Error importing account ${account.domain}:`, error);
          errors++;
        }
      }

      return {
        success: true,
        imported,
        updated,
        errors,
        total: input.accounts.length,
      };
    }),

  /**
   * Get import status and statistics
   */
  getImportStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const allAccounts = await db.select().from(accounts);
    
    const withStack = allAccounts.filter((a: any) => a.techStack && a.techStack !== '{}').length;
    const withResearch = 0; // research field removed from schema
    const withTriggers = allAccounts.filter((a: any) => a.triggerEvents && a.triggerEvents !== '{}').length;

    return {
      total: allAccounts.length,
      withStack,
      withResearch,
      withTriggers,
    };
  }),
});
