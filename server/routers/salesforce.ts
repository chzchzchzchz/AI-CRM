/**
 * Salesforce Sync tRPC Router
 * Handles sync operations between Salesforce and the dashboard
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as salesforce from "../salesforce";
import { bulkUpsertAccountsFromSalesforce, bulkUpsertContactsFromSalesforce, getSyncStatus } from "../db";
import { ENV } from "../_core/env";
import { assertDeploymentConnectorAllowed } from "../_core/tenancy";
import { resolveCredentials, withCredentials } from "../_core/connector-credentials";
import { getDb as getDatabase } from "../db";

/**
 * Every procedure below spends somebody's SALESFORCE_* credentials. The sync ones pull
 * `SELECT … FROM Account` with no limit — a whole Salesforce org — and write it into the
 * CALLER's workspace, so which credentials are in force decides whose book of business
 * lands where. `getSyncStatus` is exempt on purpose: it reads the caller's own rows, and
 * it is what the page can still show when it cannot sync.
 */
const CONNECTOR = "Salesforce";

/**
 * Whose Salesforce this call talks to, and the refusal when the answer is nobody's.
 *
 * The organization's own stored credentials if it has any; the deployment's environment
 * only for the organization that owns the deployment. Anyone else is refused — which is
 * the same answer as before, except it is now escapable by bringing your own credentials
 * rather than permanent.
 *
 * Everything inside the callback runs in that credential scope, so server/salesforce.ts
 * reads the caller's values and cannot fall through to the environment.
 */
async function asSalesforceFor<T>(orgId: number, fn: () => Promise<T>): Promise<T> {
  const resolved = await resolveCredentials(await getDatabase(), orgId, "salesforce");
  if (resolved) return withCredentials(resolved.values, fn);

  // Nothing of their own. Only the workspace that owns the deployment may fall back to
  // its environment — and this throws for anyone else.
  assertDeploymentConnectorAllowed(orgId, CONNECTOR);

  // The deployment's own workspace, with nothing configured anywhere. An EMPTY scope on
  // purpose: the accessors return "" and salesforce.ts reports itself unconfigured, which
  // is the truth. Running unscoped here would read process.env — which is exactly what we
  // just established is empty, but relying on that would leave the one code path where a
  // scope is absent, and that is the path this whole mechanism exists to remove.
  return withCredentials({}, fn);
}

export const salesforceRouter = router({
  /**
   * Get configured Salesforce instance URL
   */
  getInstanceUrl: protectedProcedure.query(async ({ ctx }) =>
    // Resolved rather than read from ENV: an organization using its own credentials is
    // pointed at its own instance, and reading the deployment's would have shown them the
    // operator's hostname — which names the operator's company.
    asSalesforceFor(ctx.orgId, async () => salesforce.instanceUrl())
  ),

  /**
   * Test Salesforce connection
   */
  testConnection: protectedProcedure.query(async ({ ctx }) =>
    asSalesforceFor(ctx.orgId, () => salesforce.testConnection())
  ),

  /**
   * Get current sync status
   */
  getSyncStatus: protectedProcedure.query(async ({ ctx }) => {
    const status = await getSyncStatus(ctx.orgId);
    return status;
  }),

  /**
   * Sync accounts from Salesforce
   */
  syncAccounts: protectedProcedure.mutation(async ({ ctx }) =>
    // Outside the try, via the helper: a refusal must reach the caller AS a refusal. The
    // catch below turns everything into { success: false, message }, which the page
    // renders as a failed sync rather than as "this is not yours to sync".
    asSalesforceFor(ctx.orgId, async () => {
    try {
      // Fetch accounts from Salesforce
      const sfAccounts = await salesforce.fetchAccounts();
      
      // Transform to dashboard format
      const transformedAccounts = sfAccounts.map(salesforce.transformAccount);
      
      // Bulk upsert to database
      const result = await bulkUpsertAccountsFromSalesforce(ctx.orgId, transformedAccounts);

      // bulkUpsertAccountsFromSalesforce tracks a per-row error count precisely so a
      // handful of bad records don't abort the whole sync — but that count went
      // nowhere: the message below never mentioned it, and the client (
      // SalesforceSync.tsx) just displays this string verbatim. A sync where 5 of 50
      // accounts failed to upsert read as "Synced 45 new accounts, updated 0 existing
      // accounts" — indistinguishable from a completely clean run, with no signal
      // that 5 accounts are now missing or stale.
      return {
        success: true,
        message: result.errors > 0
          ? `Synced ${result.inserted} new accounts, updated ${result.updated} existing (${result.errors} failed — see server logs)`
          : `Synced ${result.inserted} new accounts, updated ${result.updated} existing accounts`,
        ...result,
        totalFromSalesforce: sfAccounts.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error syncing accounts',
        inserted: 0,
        updated: 0,
        errors: 1,
        totalFromSalesforce: 0,
      };
    }
  })),

  /**
   * Sync contacts from Salesforce
   */
  syncContacts: protectedProcedure.mutation(async ({ ctx }) =>
    // Outside the try, via the helper: a refusal must reach the caller AS a refusal. The
    // catch below turns everything into { success: false, message }, which the page
    // renders as a failed sync rather than as "this is not yours to sync".
    asSalesforceFor(ctx.orgId, async () => {
    try {
      // Fetch contacts from Salesforce
      const sfContacts = await salesforce.fetchContacts();
      
      // Transform to dashboard format
      const transformedContacts = sfContacts.map(salesforce.transformContact);
      
      // Bulk upsert to database
      const result = await bulkUpsertContactsFromSalesforce(ctx.orgId, transformedContacts);

      // Same gap as syncAccounts above: result.errors was tracked and then dropped
      // before it reached the message the client actually shows.
      return {
        success: true,
        message: result.errors > 0
          ? `Synced ${result.inserted} new contacts, updated ${result.updated} existing, ${result.linked} linked (${result.errors} failed — see server logs)`
          : `Synced ${result.inserted} new contacts, updated ${result.updated} existing, ${result.linked} linked to accounts`,
        ...result,
        totalFromSalesforce: sfContacts.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error syncing contacts',
        inserted: 0,
        updated: 0,
        linked: 0,
        errors: 1,
        totalFromSalesforce: 0,
      };
    }
  })),

  /**
   * Full sync - accounts then contacts
   */
  fullSync: protectedProcedure.mutation(async ({ ctx }) =>
    // Outside the try, via the helper — see syncAccounts.
    asSalesforceFor(ctx.orgId, async () => {
    const results = {
      accounts: { success: false, message: '', inserted: 0, updated: 0, errors: 0 },
      contacts: { success: false, message: '', inserted: 0, updated: 0, linked: 0, errors: 0 },
    };

    try {
      // Step 1: Sync accounts first
      const sfAccounts = await salesforce.fetchAccounts();
      const transformedAccounts = sfAccounts.map(salesforce.transformAccount);
      const accountResult = await bulkUpsertAccountsFromSalesforce(ctx.orgId, transformedAccounts);
      results.accounts = {
        success: true,
        message: `Synced ${accountResult.inserted} new, ${accountResult.updated} updated`,
        ...accountResult,
      };

      // Step 2: Sync contacts (after accounts so linking works)
      const sfContacts = await salesforce.fetchContacts();
      const transformedContacts = sfContacts.map(salesforce.transformContact);
      const contactResult = await bulkUpsertContactsFromSalesforce(ctx.orgId, transformedContacts);
      results.contacts = {
        success: true,
        message: `Synced ${contactResult.inserted} new, ${contactResult.updated} updated, ${contactResult.linked} linked`,
        ...contactResult,
      };

      // 'Full sync completed successfully' used to be unconditional — every account
      // and every contact could individually fail to upsert (each is caught per-row
      // in bulkUpsert*FromSalesforce, so none of that aborts the loop or throws here)
      // and this message would say the same thing as a totally clean run.
      const totalErrors = accountResult.errors + contactResult.errors;
      return {
        success: true,
        message: totalErrors > 0
          ? `Full sync completed with ${totalErrors} error(s) — see server logs`
          : 'Full sync completed successfully',
        results,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error during full sync',
        results,
      };
    }
  })),
});
