/**
 * Salesforce Sync tRPC Router
 * Handles sync operations between Salesforce and the dashboard
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as salesforce from "../salesforce";
import { bulkUpsertAccountsFromSalesforce, bulkUpsertContactsFromSalesforce, getSyncStatus } from "../db";
import { ENV } from "../_core/env";

export const salesforceRouter = router({
  /**
   * Get configured Salesforce instance URL
   */
  getInstanceUrl: protectedProcedure.query(async () => {
    return ENV.salesforceInstanceUrl;
  }),

  /**
   * Test Salesforce connection
   */
  testConnection: protectedProcedure.query(async () => {
    const result = await salesforce.testConnection();
    return result;
  }),

  /**
   * Get current sync status
   */
  getSyncStatus: protectedProcedure.query(async () => {
    const status = await getSyncStatus();
    return status;
  }),

  /**
   * Sync accounts from Salesforce
   */
  syncAccounts: protectedProcedure.mutation(async () => {
    try {
      // Fetch accounts from Salesforce
      const sfAccounts = await salesforce.fetchAccounts();
      
      // Transform to dashboard format
      const transformedAccounts = sfAccounts.map(salesforce.transformAccount);
      
      // Bulk upsert to database
      const result = await bulkUpsertAccountsFromSalesforce(transformedAccounts);

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
  }),

  /**
   * Sync contacts from Salesforce
   */
  syncContacts: protectedProcedure.mutation(async () => {
    try {
      // Fetch contacts from Salesforce
      const sfContacts = await salesforce.fetchContacts();
      
      // Transform to dashboard format
      const transformedContacts = sfContacts.map(salesforce.transformContact);
      
      // Bulk upsert to database
      const result = await bulkUpsertContactsFromSalesforce(transformedContacts);

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
  }),

  /**
   * Full sync - accounts then contacts
   */
  fullSync: protectedProcedure.mutation(async () => {
    const results = {
      accounts: { success: false, message: '', inserted: 0, updated: 0, errors: 0 },
      contacts: { success: false, message: '', inserted: 0, updated: 0, linked: 0, errors: 0 },
    };

    try {
      // Step 1: Sync accounts first
      const sfAccounts = await salesforce.fetchAccounts();
      const transformedAccounts = sfAccounts.map(salesforce.transformAccount);
      const accountResult = await bulkUpsertAccountsFromSalesforce(transformedAccounts);
      results.accounts = {
        success: true,
        message: `Synced ${accountResult.inserted} new, ${accountResult.updated} updated`,
        ...accountResult,
      };

      // Step 2: Sync contacts (after accounts so linking works)
      const sfContacts = await salesforce.fetchContacts();
      const transformedContacts = sfContacts.map(salesforce.transformContact);
      const contactResult = await bulkUpsertContactsFromSalesforce(transformedContacts);
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
  }),
});
