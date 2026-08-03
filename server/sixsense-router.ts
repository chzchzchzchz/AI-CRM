import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getCompanyByDomain, getCompanyByIP, enrichAccount, enrichAccountDetailed } from "./sixsense";
// Real intent-spike detection, computed from the intentScores time series.
import { detectIntentSpikes } from "./intel/spikes";
const detectAndNotifyIntentSpikes = () => detectIntentSpikes();
const getRecentIntentSpikes = (limit: number = 10) => detectIntentSpikes({ limit });
import { getDb } from "./db";
import { accounts } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const sixsenseRouter = router({
  /**
   * Sync a single account with 6sense data by domain
   */
  syncAccountByDomain: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        domain: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { accountId, domain } = input;

      try {
        // Fetch data from 6sense.
        //
        // The detailed variant, because "No 6sense data found" was previously the
        // message for a revoked key, an unset key and a network failure as well as a
        // genuine miss — four different problems, one sentence, three of them wrong.
        const enriched = await enrichAccountDetailed(domain);

        if (!enriched.ok) {
          return {
            success: false,
            reason: enriched.reason,
            message:
              enriched.reason === "no_match"
                ? `No 6sense data found for domain: ${domain}`
                : enriched.message,
          };
        }
        const sixsenseData = enriched.account;

        // Update account with 6sense data
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db
          .update(accounts)
          .set({
            // Firmographics
            ...(sixsenseData.employeeCount && {
              employeeCount: sixsenseData.employeeCount,
            }),
            ...(sixsenseData.industry && { industry: sixsenseData.industry }),
            ...(sixsenseData.region && { region: sixsenseData.region }),
            ...(sixsenseData.annualRevenue && {
              revenue: String(sixsenseData.annualRevenue),
            }),
            // Intent and scoring
            ...(sixsenseData.intentScore !== undefined && {
              intentScore: sixsenseData.intentScore,
            }),
            // 6sense metadata
            sixsenseId: sixsenseData.sixsenseId || null,
            sixsenseBuyingStage: sixsenseData.buyingStage || null,
            sixsenseProfileFit: sixsenseData.profileFit || null,
            sixsenseSegments: sixsenseData.segments
              ? JSON.stringify(sixsenseData.segments)
              : null,
            lastSixsenseSync: new Date(),
          })
          .where(eq(accounts.id, accountId));

        return {
          success: true,
          message: `Successfully synced 6sense data for ${sixsenseData.companyName || domain}`,
          data: sixsenseData,
        };
      } catch (error) {
        console.error("[6sense] Sync failed:", error);
        return {
          success: false,
          message: `Failed to sync 6sense data: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }),

  /**
   * Sync all accounts with 6sense data
   */
  syncAllAccounts: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Get accounts that need syncing (haven't been synced in last 24 hours)
        const accountsToSync = await db
          .select({
            id: accounts.id,
            name: accounts.name,
            domain: accounts.domain,
            lastSixsenseSync: accounts.lastSixsenseSync,
          })
          .from(accounts)
          .where(eq(accounts.domain, accounts.domain)) // Filter out null domains
          .limit(input.limit);

        const results = {
          total: accountsToSync.length,
          synced: 0,
          failed: 0,
          skipped: 0,
        };

        for (const account of accountsToSync) {
          if (!account.domain) {
            results.skipped++;
            continue;
          }

          try {
            const sixsenseData = await enrichAccount(account.domain);

            if (!sixsenseData) {
              results.skipped++;
              continue;
            }

            await db
              .update(accounts)
              .set({
                ...(sixsenseData.employeeCount && {
                  employeeCount: sixsenseData.employeeCount,
                }),
                ...(sixsenseData.industry && { industry: sixsenseData.industry }),
                ...(sixsenseData.region && { region: sixsenseData.region }),
                ...(sixsenseData.annualRevenue && {
                  revenue: String(sixsenseData.annualRevenue),
                }),
                ...(sixsenseData.intentScore !== undefined && {
                  intentScore: sixsenseData.intentScore,
                }),
                sixsenseId: sixsenseData.sixsenseId || null,
                sixsenseBuyingStage: sixsenseData.buyingStage || null,
                sixsenseProfileFit: sixsenseData.profileFit || null,
                sixsenseSegments: sixsenseData.segments
                  ? JSON.stringify(sixsenseData.segments)
                  : null,
                lastSixsenseSync: new Date(),
              })
              .where(eq(accounts.id, account.id));

            results.synced++;
          } catch (error) {
            console.error(`[6sense] Failed to sync account ${account.id}:`, error);
            results.failed++;
          }

          // Rate limiting: wait 100ms between requests
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return {
          success: true,
          message: `Synced ${results.synced} accounts, ${results.failed} failed, ${results.skipped} skipped`,
          results,
        };
      } catch (error) {
        console.error("[6sense] Bulk sync failed:", error);
        return {
          success: false,
          message: `Failed to sync accounts: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }),

  /**
   * Identify company by IP address
   */
  identifyByIP: protectedProcedure
    .input(
      z.object({
        ipAddress: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const companyData = await getCompanyByIP(input.ipAddress);

        if (!companyData) {
          return {
            success: false,
            message: `No company found for IP: ${input.ipAddress}`,
          };
        }

        return {
          success: true,
          data: companyData,
        };
      } catch (error) {
        console.error("[6sense] IP identification failed:", error);
        return {
          success: false,
          message: `Failed to identify company: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }),

  /**
   * Get 6sense sync status for all accounts
   */
  getSyncStatus: protectedProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const totalAccounts = await db
        .select({ count: accounts.id })
        .from(accounts);

      const syncedAccounts = await db
        .select({ count: accounts.id })
        .from(accounts)
        .where(eq(accounts.lastSixsenseSync, accounts.lastSixsenseSync));

      return {
        total: totalAccounts.length,
        synced: syncedAccounts.length,
        unsynced: totalAccounts.length - syncedAccounts.length,
      };
    } catch (error) {
      console.error("[6sense] Failed to get sync status:", error);
      return {
        total: 0,
        synced: 0,
        unsynced: 0,
      };
    }
  }),

  /**
   * Detect and notify about intent spikes (20+ point increases)
   */
  detectIntentSpikes: protectedProcedure
    .mutation(async () => {
      const spikes = await detectAndNotifyIntentSpikes();
      return {
        success: true,
        spikesDetected: spikes.length,
        spikes,
      };
    }),

  /**
   * Get recent intent spikes for AI assistant queries
   */
  getRecentSpikes: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(10) }))
    .query(async ({ input }) => {
      return await getRecentIntentSpikes(input.limit);
    }),
});
