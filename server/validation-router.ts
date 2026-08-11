import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  validateAccount,
  validateContact,
  validateAllAccounts,
  validateAllContacts,
  getValidationSummary,
  resetSearchEvidenceStats,
  searchEvidenceStats,
  ValidationIssue
} from "./dataValidation";
import { getAccountById, getAllAccounts, getAllPeople } from "./db";
import { Account, Contact } from "../drizzle/schema";

/**
 * Fields `fixIssue` will write. Never trust a field name straight from the client onto
 * a DB column.
 *
 * Exported and reported per-issue so the UI can hide a fix control it would be refused
 * for, rather than offering a button that always fails. One list, both decisions.
 */
export const EDITABLE_FIELDS: Record<"account" | "contact", Set<string>> = {
  account: new Set([
    "name", "domain", "industry", "employeeCount", "revenue", "location",
    "region", "website", "linkedinUrl", "phone", "description",
  ]),
  contact: new Set([
    "name", "firstName", "lastName", "title", "email", "phone",
    "linkedinUrl", "location", "department",
  ]),
};

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
      const contact = contacts.find((c: Contact) => c.id === input.contactId);
      
      if (!contact) {
        throw new Error(`Contact ${input.contactId} not found`);
      }
      
      const accounts = await getAllAccounts();
      const account = accounts.find((a: Account) => a.id === contact.accountId);
      
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
      resetSearchEvidenceStats();
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
        allIssues: issues,
        // Web search is a best-effort scrape with no API key behind it — when it comes
        // back empty, the check is skipped rather than reported as clean (see
        // NO_SEARCH_EVIDENCE in dataValidation.ts). Surface that so "0 issues" can be
        // told apart from "nothing could actually be checked".
        searchChecksAttempted: searchEvidenceStats.checked,
        searchChecksUnavailable: searchEvidenceStats.noEvidence,
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
      resetSearchEvidenceStats();
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
        allIssues: issues,
        searchChecksAttempted: searchEvidenceStats.checked,
        searchChecksUnavailable: searchEvidenceStats.noEvidence,
      };
    }),

  /**
   * Validate ALL accounts (bulk operation with progress tracking)
   */
  validateAllAccountsBulk: protectedProcedure
    .mutation(async () => {
      resetSearchEvidenceStats();
      const accounts = await getAllAccounts();
      const totalAccounts = accounts.length;

      // Process in batches of 50 to avoid timeout
      const batchSize = 50;
      const allIssues: ValidationIssue[] = [];

      for (let i = 0; i < totalAccounts; i += batchSize) {
        const batch = accounts.slice(i, i + batchSize);
        const batchIssues = await Promise.all(
          batch.map((account: Account) => validateAccount(account))
        );
        allIssues.push(...batchIssues.flat());
      }

      return {
        totalAccounts,
        totalIssues: allIssues.length,
        criticalIssues: allIssues.filter(i => i.severity === 'critical').length,
        warningIssues: allIssues.filter(i => i.severity === 'warning').length,
        // Named to match validateAccounts/validateContacts' shape — the results panel
        // renders whichever of the three mutations last ran, and used to crash on this
        // one specifically: it returned `issues` while the panel always read `allIssues`.
        allIssues,
        searchChecksAttempted: searchEvidenceStats.checked,
        searchChecksUnavailable: searchEvidenceStats.noEvidence,
      };
    }),

  /**
   * Get all validation issues — computed deterministically from the current data (no LLM /
   * web search, so it's instant). Surfaces missing/malformed fields on accounts and
   * contacts. The heavier evidence-backed checks live in validateAllAccounts/Contacts.
   */
  getAllIssues: protectedProcedure.query(async () => {
    const accounts = await getAllAccounts();
    const contacts = await getAllPeople();
    const issues: ValidationIssue[] = [];
    const now = new Date();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const a of accounts as any[]) {
      const base = { type: "account" as const, entityId: a.id, entityName: a.name || `Account ${a.id}`, confidence: 1, lastChecked: now };
      if (!a.domain) issues.push({ ...base, id: `acc-${a.id}-domain`, severity: "warning", field: "domain", issue: "Missing domain", suggestion: "Add the company website domain." });
      if (!a.industry) issues.push({ ...base, id: `acc-${a.id}-industry`, severity: "info", field: "industry", issue: "Missing industry", suggestion: "Set the industry for better segmentation." });
      if (!a.employeeCount) issues.push({ ...base, id: `acc-${a.id}-emp`, severity: "info", field: "employeeCount", issue: "Missing employee count", suggestion: "Add headcount for sizing." });
      if (a.intentScore != null && (a.intentScore < 0 || a.intentScore > 100)) issues.push({ ...base, id: `acc-${a.id}-intent`, severity: "critical", field: "intentScore", issue: `Intent score out of range (${a.intentScore})`, suggestion: "Intent score must be 0–100." });
    }
    for (const c of contacts as any[]) {
      const base = { type: "contact" as const, entityId: c.id, entityName: c.name || `Contact ${c.id}`, confidence: 1, lastChecked: now };
      if (!c.email) issues.push({ ...base, id: `con-${c.id}-email`, severity: "warning", field: "email", issue: "Missing email", suggestion: "Add an email to enable outreach." });
      else if (!emailRe.test(c.email)) issues.push({ ...base, id: `con-${c.id}-email-bad`, severity: "critical", field: "email", issue: `Malformed email (${c.email})`, suggestion: "Fix the email format." });
      if (!c.title) issues.push({ ...base, id: `con-${c.id}-title`, severity: "info", field: "title", issue: "Missing title", suggestion: "Add a job title." });
      if (!c.accountId) issues.push({ ...base, id: `con-${c.id}-acct`, severity: "warning", field: "accountId", issue: "Not linked to an account", suggestion: "Associate this contact with an account." });
    }

    // Severity order, then entity, so the list opens on what actually matters rather
    // than on whichever account happens to be first.
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    issues.sort(
      (a, b) =>
        rank[a.severity as keyof typeof rank] - rank[b.severity as keyof typeof rank] ||
        a.entityName.localeCompare(b.entityName)
    );

    return {
      issues: issues.map((i) => ({
        ...i,
        // Whether `fixIssue` would accept a correction for this field. A ValidationIssue
        // may also describe a "relationship" (a link between two records), which has no
        // single column to write — never editable in place.
        editable:
          (i.type === "account" || i.type === "contact") &&
          EDITABLE_FIELDS[i.type].has(i.field),
      })),
      totalIssues: issues.length,
      criticalIssues: issues.filter((i) => i.severity === "critical").length,
      warningIssues: issues.filter((i) => i.severity === "warning").length,
      infoIssues: issues.filter((i) => i.severity === "info").length,
      // Split by entity so the summary panel can be driven from this same list.
      // getValidationSummary counts a slightly different set of checks, and its
      // `totalIssues` is an account+contact combined figure — displayed under an
      // "Account Issues" heading it read as nonsense next to its own breakdown.
      accountIssues: issues.filter((i) => i.type === "account").length,
      contactIssues: issues.filter((i) => i.type === "contact").length,
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
      if (!EDITABLE_FIELDS[input.entityType].has(input.field)) {
        return { success: false, message: `Field "${input.field}" is not editable` };
      }

      // employeeCount is the one numeric account field.
      const value: any = input.field === 'employeeCount' ? Number(input.newValue) || null : input.newValue;

      const { getDb, updateAccount } = await import("./db");
      const db = await getDb();
      if (!db) return { success: false, message: "Database not available" };

      try {
        if (input.entityType === 'account') {
          await updateAccount(input.entityId, { [input.field]: value } as any);
        } else {
          const { contacts } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(contacts).set({ [input.field]: value, updatedAt: new Date() } as any)
            .where(eq(contacts.id, input.entityId));
        }
        return { success: true, message: `Updated ${input.field} on ${input.entityType} ${input.entityId}` };
      } catch (error) {
        console.error(`[validation.fixIssue] failed:`, error);
        return { success: false, message: `Failed to update ${input.field}` };
      }
    })
});
