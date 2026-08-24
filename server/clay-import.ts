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

          // Map onto the real account columns — stack/research/trigger are not columns
          // (techStack / triggerEvents / aiResearchCache are), so the old shape discarded
          // every enrichment field it claimed to import.
          const accountData: Record<string, any> = {
            name: account.name || account.domain,
            domain: account.domain,
            techStack: Object.keys(account.stack || {}).length > 0 ? JSON.stringify(account.stack) : null,
            triggerEvents: Object.keys(account.trigger || {}).length > 0 ? JSON.stringify(account.trigger) : null,
            aiResearchCache: Object.keys(account.research || {}).length > 0 ? JSON.stringify(account.research) : null,
            rawData: Object.keys(account.rawData || {}).length > 0 ? account.rawData : null,
          };
          for (const k of Object.keys(accountData)) {
            if (accountData[k] === null) delete accountData[k];
          }

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
        // Unconditional before this: an automation driving this endpoint (there is no
        // client UI for it — see inventory.ts) that checks `success` first, the normal
        // fast path, saw true even when every single row failed (e.g. a Clay export
        // renamed its domain column, so accountData.domain was empty on every row).
        // false only when there was something to import and none of it landed.
        success: !(errors > 0 && imported === 0 && updated === 0),
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

          // Real columns — not stack/research/trigger (those aren't on the accounts table).
          const accountData: Record<string, any> = {
            name: account.name,
            domain: account.domain,
            techStack: account.stack ? JSON.stringify(account.stack) : null,
            triggerEvents: account.trigger ? JSON.stringify(account.trigger) : null,
            aiResearchCache: account.research ? JSON.stringify(account.research) : null,
            rawData: account.rawData ? account.rawData : null,
          };
          for (const k of Object.keys(accountData)) {
            if (accountData[k] === null) delete accountData[k];
          }

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
        success: !(errors > 0 && imported === 0 && updated === 0),
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
    const withResearch = allAccounts.filter((a: any) => a.aiResearchCache && a.aiResearchCache !== '{}').length;
    const withTriggers = allAccounts.filter((a: any) => a.triggerEvents && a.triggerEvents !== '{}').length;

    return {
      total: allAccounts.length,
      withStack,
      withResearch,
      withTriggers,
    };
  }),
});
