import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, tinyint, decimal, index, unique } from "drizzle-orm/mysql-core";

/**
 * The tenant boundary.
 *
 * Everything a customer owns hangs off an org id. Until this existed, `protectedProcedure`
 * meant "any signed-in user" and no query carried an owner, so two customers on one
 * deployment would have read each other's accounts and pipeline — the reason the README
 * said one deployment per team.
 *
 * Existing rows all belong to org 1: a single-tenant install is a multi-tenant install
 * with one tenant, so nothing about the demo or an existing deployment changes shape.
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * A credential that identifies an organization to an inbound webhook.
 *
 * Webhook receivers are publicProcedures: an HTTP POST with no session, so there is no
 * `ctx.orgId` to read. With one shared secret in the environment there is also no way to
 * tell whose data an inbound record is — every Clay row would land in the same org
 * regardless of who sent it, which is why those receivers were the last thing standing
 * between this codebase and multi-org.
 *
 * One secret per organization per provider fixes that: the org is resolved FROM the
 * credential the caller presented, exactly as `ctx.orgId` is resolved from a session.
 *
 * Stored as a SHA-256 hash, not bcrypt: this is looked up BY the secret on every inbound
 * webhook, so it has to be a deterministic index probe rather than a scan of every row
 * doing a slow comparison. The secret is 256 bits from a CSPRNG, so it has no guessable
 * structure for a fast hash to expose — the reasoning that makes bcrypt necessary for
 * human-chosen passwords does not apply.
 */
export const webhookCredentials = mysqlTable("webhook_credentials", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  secretHash: varchar("secretHash", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  // Set rather than deleting the row, so a revoked credential stays auditable.
  revokedAt: timestamp("revokedAt"),
});

export type WebhookCredential = typeof webhookCredentials.$inferSelect;
export type InsertWebhookCredential = typeof webhookCredentials.$inferInsert;

/**
 * An invitation to join an existing organization.
 *
 * Without this a customer cannot add a colleague. Self-serve signup gives every new
 * person their OWN organization, and the public access-request form has no org to attach
 * to, so it lands in the default one — invisible to the admin of the org that actually
 * wanted the teammate. A sales-team product where a team cannot be a team.
 *
 * The token is stored as a SHA-256 hash, never in the clear: this row is a bearer
 * credential that creates an approved account inside a customer's workspace, so a leaked
 * database dump must not be a set of working invitations. Hashed rather than bcrypted
 * because it is looked up BY the token on every acceptance, and 256 bits from a CSPRNG
 * has no structure a fast hash exposes — the same reasoning as webhook_credentials.
 */
export const organizationInvites = mysqlTable("organization_invites", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  invitedBy: int("invitedBy"),
  expiresAt: timestamp("expiresAt").notNull(),
  // Set rather than deleted, so a spent invitation stays auditable — and so "already
  // used" can be told apart from "never existed", which are different answers to give
  // someone standing at a broken link.
  acceptedAt: timestamp("acceptedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrganizationInvite = typeof organizationInvites.$inferSelect;
export type InsertOrganizationInvite = typeof organizationInvites.$inferInsert;

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  // Which tenant this user belongs to. Defaulted rather than nullable: a user with no
  // org is a user no query can scope, which is the state this column exists to end.
  orgId: int("orgId").default(1).notNull(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  // App-level checks (server/routers.ts signUp) already reject a duplicate before
  // inserting, but that check-then-insert has a race window on concurrent requests,
  // and it's only as good as every call site remembering to run it. A unique index is
  // the actual guarantee; MySQL allows multiple NULLs through a unique column, so this
  // doesn't constrain the OAuth users who sign up with no email at all.
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }), // For email/password auth
  loginMethod: varchar("loginMethod", { length: 64 }), // 'oauth', 'email', 'demo'
  isApproved: boolean("isApproved").default(false), // For demo access approval
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  twoFactorEnabled: boolean("twoFactorEnabled").default(false), // 2FA status
  twoFactorSecret: varchar("twoFactorSecret", { length: 255 }), // TOTP secret
  // Bcrypt hashes of single-use recovery codes, JSON array. Hashed because a recovery
  // code IS a credential — it bypasses the second factor entirely.
  //
  // There was no column for these before, which meant the ten codes shown at enrolment
  // were generated, displayed, and discarded. A user who lost their phone had a printed
  // list of strings that could never be redeemed, and no way to know until they tried.
  twoFactorBackupCodes: text("twoFactorBackupCodes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// Access requests table for demo/conference access
export const accessRequests = mysqlTable("access_requests", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  reason: text("reason"), // Why the applicant wants access
  status: mysqlEnum("status", ["pending", "approved", "denied"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"), // Admin who reviewed
  reviewedAt: timestamp("reviewedAt"),
  // Why the admin denied it — distinct from `reason` above (the applicant's own words).
  // denyAccessRequest's zod input already accepted this and the deny dialog already
  // prompted for it; there was no column to put it in, so it was validated, submitted,
  // and silently thrown away every time.
  denialReason: text("denialReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Accounts table
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  clayRecordId: varchar("clayRecordId", { length: 255 }),
  clayTableId: varchar("clayTableId", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  domainVariations: json("domainVariations"), // Array of domain variations, subdomains, aliases
  industry: varchar("industry", { length: 100 }),
  employeeCount: int("employeeCount"),
  revenue: varchar("revenue", { length: 100 }),
  location: varchar("location", { length: 255 }),
  region: varchar("region", { length: 100 }),
  intentScore: int("intentScore").default(0),
  relationship: varchar("relationship", { length: 50 }).default("Prospect"),
  description: text("description"),
  website: varchar("website", { length: 500 }),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  techStack: text("techStack"),
  securityStack: text("securityStack"),
  triggerEvents: text("triggerEvents"),
  rawData: json("rawData"),
  aiOverviewCache: text("aiOverviewCache"),
  aiInsightsCache: text("aiInsightsCache"),
  aiResearchCache: text("aiResearchCache"),
  aiCacheUpdatedAt: timestamp("aiCacheUpdatedAt"),
  // 6sense integration fields
  sixsenseId: varchar("sixsenseId", { length: 255 }),
  sixsenseBuyingStage: varchar("sixsenseBuyingStage", { length: 100 }),
  sixsenseProfileFit: varchar("sixsenseProfileFit", { length: 100 }),
  sixsenseSegments: text("sixsenseSegments"), // JSON array of segments
  lastSixsenseSync: timestamp("lastSixsenseSync"),
  // Salesforce integration fields
  sfdcAccountId: varchar("sfdcAccountId", { length: 18 }), // Salesforce 18-char ID
  phone: varchar("phone", { length: 50 }),
  type: varchar("type", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Unique per org, not globally: two tenants can legitimately hold the same
  // external identifier, and a global unique would make the second one's import
  // collide with — or silently read — the first one's row.
  clayRecordIdIdx: unique('accounts_org_clayRecordId').on(table.orgId, table.clayRecordId),
}));

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

// Contacts table
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountId: int("accountId"),  // Nullable to allow contacts without accounts during sync
  clayRecordId: varchar("clayRecordId", { length: 255 }),
  firstName: varchar("firstName", { length: 255 }),
  lastName: varchar("lastName", { length: 255 }),
  name: varchar("name", { length: 255 }),
  title: varchar("title", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  location: varchar("location", { length: 255 }),
  department: varchar("department", { length: 100 }),
  // Salesforce integration fields
  sfdcContactId: varchar("sfdcContactId", { length: 18 }), // Salesforce 18-char ID
  mobilePhone: varchar("mobilePhone", { length: 50 }),
  directPhone: varchar("directPhone", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Unique per org, not globally: two tenants can legitimately hold the same
  // external identifier, and a global unique would make the second one's import
  // collide with — or silently read — the first one's row.
  clayRecordIdIdx: unique('contacts_org_clayRecordId').on(table.orgId, table.clayRecordId),
}));

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// Calls table
export const calls = mysqlTable("calls", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountId: int("accountId"),
  contactId: int("contactId"),
  title: varchar("title", { length: 255 }),
  duration: int("duration"), // in seconds
  recordingUrl: varchar("recordingUrl", { length: 500 }),
  transcriptUrl: varchar("transcriptUrl", { length: 500 }),
  gongCallId: varchar("gongCallId", { length: 255 }),
  sentiment: varchar("sentiment", { length: 50 }),
  keyTopics: text("keyTopics"), // JSON string
  actionItems: text("actionItems"), // JSON string
  callDate: timestamp("callDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Unique per org, not globally: two tenants can legitimately hold the same
  // external identifier, and a global unique would make the second one's import
  // collide with — or silently read — the first one's row.
  gongCallIdIdx: unique('calls_org_gongCallId').on(table.orgId, table.gongCallId),
}));

export type Call = typeof calls.$inferSelect;
export type InsertCall = typeof calls.$inferInsert;

// RFPs table
export const rfps = mysqlTable("rfps", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountId: int("accountId"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  agency: varchar("agency", { length: 255 }),
  solicitationNumber: varchar("solicitationNumber", { length: 255 }),
  postedDate: timestamp("postedDate"),
  responseDeadline: timestamp("responseDeadline"),
  awardAmount: varchar("awardAmount", { length: 100 }),
  samGovId: varchar("samGovId", { length: 255 }),
  url: varchar("url", { length: 500 }),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Unique per org, not globally: two tenants can legitimately hold the same
  // external identifier, and a global unique would make the second one's import
  // collide with — or silently read — the first one's row.
  solicitationNumberIdx: unique('rfps_org_solicitationNumber').on(table.orgId, table.solicitationNumber),
  samGovIdIdx: unique('rfps_org_samGovId').on(table.orgId, table.samGovId),
}));

export type RFP = typeof rfps.$inferSelect;
export type InsertRFP = typeof rfps.$inferInsert;

// Intent Scores table
export const intentScores = mysqlTable("intentScores", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountId: int("accountId").notNull(),
  score: int("score").notNull(),
  category: varchar("category", { length: 100 }),
  keywords: text("keywords"), // JSON string
  source: varchar("source", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntentScore = typeof intentScores.$inferSelect;
export type InsertIntentScore = typeof intentScores.$inferInsert;

// AI Context table
export const aiContext = mysqlTable("aiContext", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountId: int("accountId"),
  contactId: int("contactId"),
  contextType: varchar("contextType", { length: 50 }).notNull(), // 'research', 'outreach', 'analysis'
  prompt: text("prompt"),
  response: text("response"),
  model: varchar("model", { length: 50 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIContext = typeof aiContext.$inferSelect;
export type InsertAIContext = typeof aiContext.$inferInsert;

// Documents table
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountId: int("accountId"),
  contactId: int("contactId"),
  callId: int("callId"),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
  fileType: varchar("fileType", { length: 100 }),
  fileSize: int("fileSize"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Enrichment Logs table
export const enrichmentLogs = mysqlTable("enrichmentLogs", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(), // 'account', 'contact'
  entityId: int("entityId").notNull(),
  source: varchar("source", { length: 50 }).notNull(), // 'clay', '6sense', 'gong'
  status: varchar("status", { length: 50 }).notNull(), // 'success', 'failed', 'pending'
  dataSnapshot: text("dataSnapshot"), // JSON string
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EnrichmentLog = typeof enrichmentLogs.$inferSelect;
export type InsertEnrichmentLog = typeof enrichmentLogs.$inferInsert;

// Validation Cache table - stores web search validation results
export const validationCache = mysqlTable("validationCache", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(), // 'account', 'contact'
  entityId: int("entityId").notNull(),
  field: varchar("field", { length: 100 }).notNull(), // 'domain', 'employeeCount', 'email', etc.
  isValid: boolean("isValid").notNull(), // true = valid, false = invalid
  severity: varchar("severity", { length: 20 }), // 'critical', 'warning', 'info'
  issue: text("issue"), // Description of the problem
  suggestion: text("suggestion"), // How to fix it
  evidence: text("evidence"), // Search results or API response
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00-1.00
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ValidationCache = typeof validationCache.$inferSelect;
export type InsertValidationCache = typeof validationCache.$inferInsert;

// Context Store for AI learning
export const contextStore = mysqlTable("contextStore", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  type: varchar("type", { length: 64 }).notNull(), // 'company_knowledge', 'user_preference', 'search_pattern', 'interaction'
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  metadata: text("metadata"), // JSON for additional context
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContextStore = typeof contextStore.$inferSelect;
export type InsertContextStore = typeof contextStore.$inferInsert;

// AI Insights cache
export const aiInsights = mysqlTable("aiInsights", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountId: int("accountId"),
  insightType: varchar("insightType", { length: 50 }).notNull(), // 'tech_stack', 'intent', 'trigger', 'research'
  title: varchar("title", { length: 255 }),
  content: text("content").notNull(),
  confidence: int("confidence"), // 0-100
  source: varchar("source", { length: 50 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AIInsight = typeof aiInsights.$inferSelect;
export type InsertAIInsight = typeof aiInsights.$inferInsert;

// Email Sequences
export const emailSequences = mysqlTable("emailSequences", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  steps: json("steps").notNull(), // Array of email steps
  isActive: boolean("isActive").default(true),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailSequence = typeof emailSequences.$inferSelect;
export type InsertEmailSequence = typeof emailSequences.$inferInsert;

/**
 * A commitment a rep made to themselves: "call the CISO at Marvel in six months".
 *
 * Everything else in this system is inbound — signals arriving, scores moving, calls
 * landing. This is the one place the rep's own intent is recorded, and it is what makes
 * the daily view a to-do list rather than a news feed. A follow-up carries the account
 * and contact it concerns so the work can be done from wherever it surfaces, without
 * navigating off to go and find them.
 */
export const followUps = mysqlTable("followUps", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  userId: int("userId").notNull(),
  accountId: int("accountId"),
  contactId: int("contactId"),
  title: varchar("title", { length: 500 }).notNull(),
  notes: text("notes"),
  dueDate: timestamp("dueDate").notNull(),
  /** "open" | "done" — snoozing moves dueDate rather than adding a third state. */
  status: varchar("status", { length: 32 }).default("open").notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // The daily read is "mine, still open, ordered by when it's due".
  dueIdx: index("followUps_user_status_due_idx").on(table.userId, table.status, table.dueDate),
}));

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;

// Outreach Campaigns
export const outreachCampaigns = mysqlTable("outreachCampaigns", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sequenceId: int("sequenceId"),
  accountIds: json("accountIds"), // Array of account IDs
  contactIds: json("contactIds"), // Array of contact IDs
  status: varchar("status", { length: 50 }).notNull(), // 'draft', 'active', 'paused', 'completed'
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  stats: json("stats"), // Campaign statistics
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;
export type InsertOutreachCampaign = typeof outreachCampaigns.$inferInsert;

// News Monitoring
export const newsItems = mysqlTable("newsItems", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountId: int("accountId"),
  title: varchar("title", { length: 500 }).notNull(),
  url: varchar("url", { length: 500 }),
  source: varchar("source", { length: 255 }),
  publishedAt: timestamp("publishedAt"),
  summary: text("summary"),
  sentiment: varchar("sentiment", { length: 50 }),
  relevanceScore: int("relevanceScore"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NewsItem = typeof newsItems.$inferSelect;
export type InsertNewsItem = typeof newsItems.$inferInsert;


// 6sense 6QA (Qualified Accounts) tracking
export const sixsense6QA = mysqlTable("sixsense6QA", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountName: varchar("accountName", { length: 255 }).notNull(),
  sixsenseId: varchar("sixsenseId", { length: 64 }),
  crmAccountId: varchar("crmAccountId", { length: 64 }),
  dateCreated: timestamp("dateCreated"),
  responseTimeDays: int("responseTimeDays").default(0),
  lastActiveDaysAgo: int("lastActiveDaysAgo").default(0),
  salesActivities: int("salesActivities").default(0),
  reachedContacts: int("reachedContacts").default(0),
  owner: varchar("owner", { length: 255 }),
  domain: varchar("domain", { length: 255 }),
  country: varchar("country", { length: 100 }),
  isWorked: boolean("isWorked").default(false),
  dataAsOf: timestamp("dataAsOf").notNull(), // When this data was exported from 6sense
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sixsense6QA = typeof sixsense6QA.$inferSelect;
export type InsertSixsense6QA = typeof sixsense6QA.$inferInsert;

// 6sense Keyword Performance
export const sixsenseKeywords = mysqlTable("sixsenseKeywords", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  totalAccounts: int("totalAccounts").default(0),
  accountsWithWebVisits: int("accountsWithWebVisits").default(0),
  accountsWith6QA: int("accountsWith6QA").default(0),
  accountsWithOpportunities: int("accountsWithOpportunities").default(0),
  accountsWithRelevantOpportunities: int("accountsWithRelevantOpportunities").default(0),
  category: varchar("category", { length: 100 }), // 'competitor', 'product', 'pain_point', 'compliance', etc.
  dataAsOf: timestamp("dataAsOf").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SixsenseKeyword = typeof sixsenseKeywords.$inferSelect;
export type InsertSixsenseKeyword = typeof sixsenseKeywords.$inferInsert;

// 6sense Buying Stage Metrics (time series)
export const sixsenseBuyingStageMetrics = mysqlTable("sixsenseBuyingStageMetrics", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  timeframe: varchar("timeframe", { length: 100 }).notNull(), // "Nov 30 - Dec 6, 2025"
  buyingStage: varchar("buyingStage", { length: 50 }).notNull(), // Target, Awareness, Consideration, Decision, Purchase
  numberOfAccounts: int("numberOfAccounts").default(0),
  newPipelineUSD: decimal("newPipelineUSD", { precision: 15, scale: 2 }),
  totalWonUSD: decimal("totalWonUSD", { precision: 15, scale: 2 }),
  dataAsOf: timestamp("dataAsOf").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SixsenseBuyingStageMetric = typeof sixsenseBuyingStageMetrics.$inferSelect;
export type InsertSixsenseBuyingStageMetric = typeof sixsenseBuyingStageMetrics.$inferInsert;

// 6sense Engagement Metrics (time series)
export const sixsenseEngagementMetrics = mysqlTable("sixsenseEngagementMetrics", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  timeWindow: varchar("timeWindow", { length: 100 }).notNull(),
  engagementState: varchar("engagementState", { length: 100 }).notNull(), // No Engagement, Intent, Anonymous Website Visit, Known Engagement, Opps Created, Opps Won
  accounts: int("accounts").default(0),
  amountUSD: decimal("amountUSD", { precision: 15, scale: 2 }),
  dataAsOf: timestamp("dataAsOf").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SixsenseEngagementMetric = typeof sixsenseEngagementMetrics.$inferSelect;
export type InsertSixsenseEngagementMetric = typeof sixsenseEngagementMetrics.$inferInsert;

// 6sense 6QA Performance (daily metrics)
export const sixsense6QAPerformance = mysqlTable("sixsense6QAPerformance", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  day: timestamp("day").notNull(),
  total6QAs: int("total6QAs").default(0),
  new6QAs: int("new6QAs").default(0),
  worked: int("worked").default(0),
  unworked: int("unworked").default(0),
  avgSalesActivities: decimal("avgSalesActivities", { precision: 5, scale: 1 }),
  avgContactsReached: decimal("avgContactsReached", { precision: 5, scale: 1 }),
  avgDaysToFirstActivity: decimal("avgDaysToFirstActivity", { precision: 5, scale: 1 }),
  avgDaysSinceLastActivity: decimal("avgDaysSinceLastActivity", { precision: 5, scale: 1 }),
  dataAsOf: timestamp("dataAsOf").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Sixsense6QAPerformance = typeof sixsense6QAPerformance.$inferSelect;
export type InsertSixsense6QAPerformance = typeof sixsense6QAPerformance.$inferInsert;

// Email History (generated outreach emails)
export const emailHistory = mysqlTable("emailHistory", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  userId: int("userId").notNull(),
  accountId: int("accountId"),
  contactId: int("contactId"),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  subject: varchar("subject", { length: 500 }),
  body: text("body"),
  attachments: json("attachments"), // Array of attachment URLs
  status: varchar("status", { length: 50 }).default("generated"), // generated, sent, opened, replied
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailHistoryRecord = typeof emailHistory.$inferSelect;
export type InsertEmailHistory = typeof emailHistory.$inferInsert;

// AI Chat History
export const aiChatHistory = mysqlTable("aiChatHistory", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  userId: int("userId").notNull(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  metadata: json("metadata"), // Additional context like account/contact references
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIChatHistoryRecord = typeof aiChatHistory.$inferSelect;
export type InsertAIChatHistory = typeof aiChatHistory.$inferInsert;


// AI Response Cache - stores cached AI responses to avoid re-generating identical queries
export const aiResponseCache = mysqlTable("aiResponseCache", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  queryHash: varchar("queryHash", { length: 64 }).notNull(), // SHA-256 hash of query + context
  query: text("query").notNull(),
  contextHash: varchar("contextHash", { length: 64 }), // Hash of additional context (accountId, etc.)
  answer: text("answer").notNull(),
  reasoning: text("reasoning"), // Optional Deep-Think reasoning
  model: varchar("model", { length: 50 }),
  hitCount: int("hitCount").default(1), // Number of times this cache entry was used
  lastHitAt: timestamp("lastHitAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // TTL for cache entry
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // Unique per org, not globally: two tenants can legitimately hold the same
  // external identifier, and a global unique would make the second one's import
  // collide with — or silently read — the first one's row.
  queryHashIdx: unique('aiResponseCache_org_query').on(table.orgId, table.queryHash),
}));

export type AIResponseCacheRecord = typeof aiResponseCache.$inferSelect;
export type InsertAIResponseCache = typeof aiResponseCache.$inferInsert;


// Knowledge Base - uploaded documents for RAG
export const knowledgeBase = mysqlTable("knowledgeBase", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(), // S3 key
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"), // bytes
  category: varchar("category", { length: 100 }), // 'battle_card', 'case_study', 'product_sheet', 'competitor_intel', 'playbook'
  status: varchar("status", { length: 50 }).default("processing"), // 'processing', 'ready', 'error'
  chunkCount: int("chunkCount").default(0),
  metadata: json("metadata"), // Additional metadata (tags, description, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeBaseDoc = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBaseDoc = typeof knowledgeBase.$inferInsert;

// Document Chunks - semantic chunks for RAG retrieval
export const documentChunks = mysqlTable("documentChunks", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  documentId: int("documentId").notNull(),
  chunkIndex: int("chunkIndex").notNull(), // Order within document
  content: text("content").notNull(),
  embedding: json("embedding"), // Vector embedding (array of floats)
  metadata: json("metadata"), // Section title, page number, etc.
  tokenCount: int("tokenCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;

// User Interactions - track all AI interactions for learning
export const userInteractions = mysqlTable("userInteractions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }),
  actionType: varchar("actionType", { length: 100 }).notNull(), // 'ai_chat', 'email_generated', 'data_processed', 'content_created'
  inputData: json("inputData"), // What the user provided
  outputData: json("outputData"), // What the AI generated
  feedback: varchar("feedback", { length: 50 }), // 'positive', 'negative', 'edited', null
  feedbackDetails: text("feedbackDetails"), // User's edits or comments
  contextUsed: json("contextUsed"), // Which RAG chunks were used
  accountId: int("accountId"), // Related account if applicable
  contactId: int("contactId"), // Related contact if applicable
  durationMs: int("durationMs"), // How long the operation took
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserInteraction = typeof userInteractions.$inferSelect;
export type InsertUserInteraction = typeof userInteractions.$inferInsert;

// Data Processing Jobs - track data imports and transformations
export const dataProcessingJobs = mysqlTable("dataProcessingJobs", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  userId: int("userId").notNull(),
  jobType: varchar("jobType", { length: 100 }).notNull(), // 'lead_import', 'account_enrichment', 'contact_merge', 'csv_transform'
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'processing', 'completed', 'failed'
  inputFileKey: varchar("inputFileKey", { length: 500 }),
  inputFileUrl: varchar("inputFileUrl", { length: 1000 }),
  outputFileKey: varchar("outputFileKey", { length: 500 }),
  outputFileUrl: varchar("outputFileUrl", { length: 1000 }),
  recordsTotal: int("recordsTotal").default(0),
  recordsProcessed: int("recordsProcessed").default(0),
  recordsSuccess: int("recordsSuccess").default(0),
  recordsFailed: int("recordsFailed").default(0),
  errorLog: json("errorLog"), // Array of errors
  fieldMappings: json("fieldMappings"), // How fields were mapped
  transformRules: json("transformRules"), // What rules were applied
  learnings: json("learnings"), // What the system learned from user corrections
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DataProcessingJob = typeof dataProcessingJobs.$inferSelect;
export type InsertDataProcessingJob = typeof dataProcessingJobs.$inferInsert;

// Generated Content - all AI-generated content with feedback
export const generatedContent = mysqlTable("generatedContent", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  userId: int("userId").notNull(),
  contentType: varchar("contentType", { length: 100 }).notNull(), // 'email', 'webinar_promo', 'battle_card', 'call_script', 'linkedin_message'
  title: varchar("title", { length: 500 }),
  content: text("content").notNull(),
  ragSourceIds: json("ragSourceIds"), // Which knowledge base docs were used
  accountId: int("accountId"),
  contactId: int("contactId"),
  promptUsed: text("promptUsed"),
  userEdits: text("userEdits"), // What the user changed
  feedback: varchar("feedback", { length: 50 }), // 'used', 'edited', 'discarded'
  outcome: varchar("outcome", { length: 100 }), // 'sent', 'opened', 'replied', 'converted'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GeneratedContentRecord = typeof generatedContent.$inferSelect;
export type InsertGeneratedContent = typeof generatedContent.$inferInsert;


// Transcript Analysis Reports
export const transcriptReports = mysqlTable("transcriptReports", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  userId: int("userId").default(0).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  transcript: text("transcript").notNull(),
  analysis: json("analysis").notNull(), // Full analysis result JSON
  accountId: int("accountId"), // Optional link to account
  contactId: int("contactId"), // Optional link to contact
  shareId: varchar("shareId", { length: 64 }).notNull(), // Public share ID for anyone to view
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TranscriptReport = typeof transcriptReports.$inferSelect;
export type InsertTranscriptReport = typeof transcriptReports.$inferInsert;

// Email verification codes table
export const emailVerificationCodes = mysqlTable("email_verification_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  code: varchar("code", { length: 6 }).notNull(), // 6-digit code
  email: varchar("email", { length: 320 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  attempts: int("attempts").default(0),
  verified: boolean("verified").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationCode = typeof emailVerificationCodes.$inferSelect;
export type InsertEmailVerificationCode = typeof emailVerificationCodes.$inferInsert;

// Password reset codes table
export const passwordResetCodes = mysqlTable("password_reset_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  code: varchar("code", { length: 32 }).notNull(), // 32-char code
  email: varchar("email", { length: 320 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetCode = typeof passwordResetCodes.$inferSelect;
export type InsertPasswordResetCode = typeof passwordResetCodes.$inferInsert;


// Audit Logs - tracks all authentication and admin events
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  userId: int("userId").notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  description: text("description").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  userAgent: text("userAgent"),
  metadata: json("metadata"), // Additional context as JSON
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Dust API cache for storing query results
export const dustCache = mysqlTable('dust_cache', {
  id: int().primaryKey().autoincrement(),
  orgId: int('orgId').default(1).notNull(),
  // Unique per org, not globally: the hash is of the query text, so two tenants asking
  // the same question produce the same hash. A global unique would mean the second
  // tenant's lookup HITS the first tenant's cached answer — a cross-tenant read of
  // whatever account data went into producing it.
  queryHash: varchar('query_hash', { length: 64 }).notNull(),
  query: text('query').notNull(),
  result: text('result').notNull(),
  accountId: int('account_id'),
  contactId: int('contact_id'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  
  // Indexes
}, (table) => ({
  accountIdx: index('dust_cache_account_id').on(table.accountId),
  contactIdx: index('dust_cache_contact_id').on(table.contactId),
  expiryIdx: index('dust_cache_expires_at').on(table.expiresAt),
  orgQueryIdx: unique('dust_cache_org_query').on(table.orgId, table.queryHash),
}));

export type DustCache = typeof dustCache.$inferSelect;
export type DustCacheInsert = typeof dustCache.$inferInsert;

// Opportunities table
export const opportunities = mysqlTable("opportunities", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").default(1).notNull(),
  accountId: int("accountId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  stage: varchar("stage", { length: 50 }).notNull().default("Discovery"),
  probability: int("probability").default(10),
  status: varchar("status", { length: 20 }).notNull().default("Open"), // Open, Won, Lost
  expectedCloseDate: timestamp("expectedCloseDate"),
  sfdcOpportunityId: varchar("sfdcOpportunityId", { length: 18 }),
  aiSuccessScore: int("aiSuccessScore"), // 0-100
  aiInsights: text("aiInsights"), // AI reasoning for success score
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Unique per org, not globally: two tenants can legitimately hold the same
  // external identifier, and a global unique would make the second one's import
  // collide with — or silently read — the first one's row.
  sfdcOpportunityIdIdx: unique('opportunities_org_sfdcOpportunityId').on(table.orgId, table.sfdcOpportunityId),
}));

export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;
