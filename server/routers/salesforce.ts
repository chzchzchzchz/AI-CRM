/**
 * Salesforce Sync tRPC Router
 * Handles sync operations between Salesforce and the dashboard
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as salesforce from "../salesforce";
import { bulkUpsertAccountsFromSalesforce, bulkUpsertContactsFromSalesforce, getSyncStatus } from "../db";

export const salesforceRouter = router({
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
      
      return {
        success: true,
        message: `Synced ${result.inserted} new accounts, updated ${result.updated} existing accounts`,
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
      
      return {
        success: true,
        message: `Synced ${result.inserted} new contacts, updated ${result.updated} existing, ${result.linked} linked to accounts`,
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

      return {
        success: true,
        message: 'Full sync completed successfully',
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
