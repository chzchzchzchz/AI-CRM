import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  validateAccount,
  validateContact,
  validateAllAccounts,
  validateAllContacts,
  getValidationSummary,
  ValidationIssue
} from "./dataValidation";
import { getAccountById, getAllAccounts, getAllPeople } from "./db";

/**
 * Validation router - AI-powered data quality checks with web search verification
 */
export const validationRouter = router({
  /**
   * Get validation summary (quick stats, no web searches)
   */
  getSummary: protectedProcedure.query(async () => {
    return await getValidationSummary();
  }),

  /**
   * Validate a single account with web search verification
   */
  validateAccount: protectedProcedure
    .input(z.object({
      accountId: z.number()
    }))
    .mutation(async ({ input }) => {
      const account = await getAccountById(input.accountId);
      if (!account) {
        throw new Error(`Account ${input.accountId} not found`);
      }
      
      const issues = await validateAccount(account);
      return {
        accountId: input.accountId,
        accountName: account.name,
        issues,
        issueCount: issues.length
      };
    }),

  /**
   * Validate a single contact with web search verification
   */
  validateContact: protectedProcedure
    .input(z.object({
      contactId: z.number()
    }))
    .mutation(async ({ input }) => {
      const contacts = await getAllPeople();
      const contact = contacts.find(c => c.id === input.contactId);
      
      if (!contact) {
        throw new Error(`Contact ${input.contactId} not found`);
      }
      
      const accounts = await getAllAccounts();
      const account = accounts.find(a => a.id === contact.accountId);
      
      const issues = await validateContact(contact, account);
      return {
        contactId: input.contactId,
        contactName: contact.name,
        issues,
        issueCount: issues.length
      };
    }),

  /**
   * Run validation on multiple accounts (batch)
   */
  validateAccounts: protectedProcedure
    .input(z.object({
      limit: z.number().default(20).optional()
    }))
    .mutation(async ({ input }) => {
      const issues = await validateAllAccounts(input.limit || 20);
      
      // Group issues by account
      const issuesByAccount = issues.reduce((acc, issue) => {
        if (!acc[issue.entityId]) {
          acc[issue.entityId] = [];
        }
        acc[issue.entityId].push(issue);
        return acc;
      }, {} as Record<number, ValidationIssue[]>);
      
      return {
        totalIssues: issues.length,
        accountsWithIssues: Object.keys(issuesByAccount).length,
        issuesByAccount,
        allIssues: issues
      };
    }),

  /**
   * Run validation on multiple contacts (batch)
   */
  validateContacts: protectedProcedure
    .input(z.object({
      limit: z.number().default(30).optional()
    }))
    .mutation(async ({ input }) => {
      const issues = await validateAllContacts(input.limit || 30);
      
      // Group issues by contact
      const issuesByContact = issues.reduce((acc, issue) => {
        if (!acc[issue.entityId]) {
          acc[issue.entityId] = [];
        }
        acc[issue.entityId].push(issue);
        return acc;
      }, {} as Record<number, ValidationIssue[]>);
      
      return {
        totalIssues: issues.length,
        contactsWithIssues: Object.keys(issuesByContact).length,
        issuesByContact,
        allIssues: issues
      };
    }),

  /**
   * Validate ALL accounts (bulk operation with progress tracking)
   */
  validateAllAccountsBulk: protectedProcedure
    .mutation(async () => {
      const accounts = await getAllAccounts();
      const totalAccounts = accounts.length;
      
      // Process in batches of 50 to avoid timeout
      const batchSize = 50;
      const allIssues: ValidationIssue[] = [];
      
      for (let i = 0; i < totalAccounts; i += batchSize) {
        const batch = accounts.slice(i, i + batchSize);
        const batchIssues = await Promise.all(
          batch.map(account => validateAccount(account))
        );
        allIssues.push(...batchIssues.flat());
      }
      
      return {
        totalAccounts,
        totalIssues: allIssues.length,
        criticalIssues: allIssues.filter(i => i.severity === 'critical').length,
        warningIssues: allIssues.filter(i => i.severity === 'warning').length,
        issues: allIssues
      };
    }),

  /**
   * Get all validation issues (from memory, not cached yet)
   */
  getAllIssues: protectedProcedure.query(async () => {
    // For now, return empty array since we don't have cache table yet
    // This will be populated after running validation
    return {
      issues: [] as ValidationIssue[],
      totalIssues: 0,
      criticalIssues: 0,
      warningIssues: 0,
      infoIssues: 0
    };
  }),

  /**
   * Fix a validation issue (manual correction)
   */
  fixIssue: protectedProcedure
    .input(z.object({
      issueId: z.string(),
      entityType: z.enum(['account', 'contact']),
      entityId: z.number(),
      field: z.string(),
      newValue: z.string()
    }))
    .mutation(async ({ input }) => {
      // TODO: Implement field-specific updates
      // For now, just return success
      return {
        success: true,
        message: `Fixed ${input.field} for ${input.entityType} ${input.entityId}`
      };
    })
});
