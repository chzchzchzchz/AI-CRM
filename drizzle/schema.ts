import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, tinyint, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Accounts table
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  clayRecordId: varchar("clayRecordId", { length: 255 }).unique(),
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
  aiCacheUpdatedAt: timestamp("aiCacheUpdatedAt"),
  // 6sense integration fields
  sixsenseId: varchar("sixsenseId", { length: 255 }),
  sixsenseBuyingStage: varchar("sixsenseBuyingStage", { length: 100 }),
  sixsenseProfileFit: varchar("sixsenseProfileFit", { length: 100 }),
  sixsenseSegments: text("sixsenseSegments"), // JSON array of segments
  lastSixsenseSync: timestamp("lastSixsenseSync"),
  // Salesforce integration fields
  sfdcAccountId: varchar("sfdcAccountId", { length: 18 }), // Salesforce 18-char ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

// Contacts table
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  clayRecordId: varchar("clayRecordId", { length: 255 }).unique(),
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
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// Calls table
export const calls = mysqlTable("calls", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId"),
  contactId: int("contactId"),
  title: varchar("title", { length: 255 }),
  duration: int("duration"), // in seconds
  recordingUrl: varchar("recordingUrl", { length: 500 }),
  transcriptUrl: varchar("transcriptUrl", { length: 500 }),
  gongCallId: varchar("gongCallId", { length: 255 }).unique(),
  sentiment: varchar("sentiment", { length: 50 }),
  keyTopics: text("keyTopics"), // JSON string
  actionItems: text("actionItems"), // JSON string
  callDate: timestamp("callDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Call = typeof calls.$inferSelect;
export type InsertCall = typeof calls.$inferInsert;

// RFPs table
export const rfps = mysqlTable("rfps", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  agency: varchar("agency", { length: 255 }),
  solicitationNumber: varchar("solicitationNumber", { length: 255 }).unique(),
  postedDate: timestamp("postedDate"),
  responseDeadline: timestamp("responseDeadline"),
  awardAmount: varchar("awardAmount", { length: 100 }),
  samGovId: varchar("samGovId", { length: 255 }).unique(),
  url: varchar("url", { length: 500 }),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RFP = typeof rfps.$inferSelect;
export type InsertRFP = typeof rfps.$inferInsert;

// Intent Scores table
export const intentScores = mysqlTable("intentScores", {
  id: int("id").autoincrement().primaryKey(),
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

// Outreach Campaigns
export const outreachCampaigns = mysqlTable("outreachCampaigns", {
  id: int("id").autoincrement().primaryKey(),
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
  queryHash: varchar("queryHash", { length: 64 }).notNull().unique(), // SHA-256 hash of query + context
  query: text("query").notNull(),
  contextHash: varchar("contextHash", { length: 64 }), // Hash of additional context (accountId, etc.)
  answer: text("answer").notNull(),
  reasoning: text("reasoning"), // Optional Deep-Think reasoning
  model: varchar("model", { length: 50 }),
  hitCount: int("hitCount").default(1), // Number of times this cache entry was used
  lastHitAt: timestamp("lastHitAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // TTL for cache entry
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIResponseCacheRecord = typeof aiResponseCache.$inferSelect;
export type InsertAIResponseCache = typeof aiResponseCache.$inferInsert;
