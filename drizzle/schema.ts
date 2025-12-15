import { int, mysqlTable, text, varchar, timestamp, json, mysqlEnum, boolean, decimal } from "drizzle-orm/mysql-core";

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
  linkedinCompanyUrl: varchar("linkedinCompanyUrl", { length: 512 }),
  linkedinCompanyId: varchar("linkedinCompanyId", { length: 64 }),
  salesNavUrl: varchar("salesNavUrl", { length: 512 }),
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
  source: varchar("source", { length: 100 }),
  followscompany: boolean("followscompany").default(false),
  // 6sense enrichment fields
  sixsenseMid: varchar("sixsenseMid", { length: 100 }),
  engagementScore: int("engagementScore"),
  profileFit: varchar("profileFit", { length: 50 }),
  profileScore: int("profileScore"),
  engagementGrade: varchar("engagementGrade", { length: 10 }),
  engagementTrend: varchar("engagementTrend", { length: 50 }),
  personaImportance: varchar("personaImportance", { length: 50 }),
  engagementActivities: int("engagementActivities"),
  salesActivities: int("salesActivities"),
  daysSinceLastEngagement: int("daysSinceLastEngagement"),
  daysSinceLastSalesActivity: int("daysSinceLastSalesActivity"),
  lastSalesActivity: varchar("lastSalesActivity", { length: 255 }),
  lastEngagementActivity: varchar("lastEngagementActivity", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
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

// Attachments table (files attached to accounts/contacts/calls)
export const attachments = mysqlTable("attachments", {
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

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

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


// ============================================
// ELITE RAG SYSTEM - "Haribo Battery"
// ============================================

// Document categories for intelligent routing
export const documentCategoryEnum = mysqlEnum("documentCategory", [
  "product_docs",      // Product documentation, features, specs
  "competitive_intel", // Competitor analysis, battlecards
  "case_studies",      // Customer success stories
  "pricing",           // Pricing docs, ROI calculators
  "technical",         // Technical whitepapers, architecture
  "sales_playbook",    // Sales methodologies, scripts
  "objection_handling", // Common objections and responses
  "general"            // Uncategorized
]);

// Knowledge Base documents table (RAG system)
export const knowledgeBase = mysqlTable("knowledgeBase", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  category: documentCategoryEnum.default("general").notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }), // S3 URL
  fileKey: varchar("fileKey", { length: 500 }), // S3 key
  fileType: varchar("fileType", { length: 50 }), // pdf, docx, txt, md, etc.
  fileSize: int("fileSize"), // bytes
  contentRaw: text("contentRaw"), // Full extracted text
  summary: text("summary"), // AI-generated document summary
  tags: json("tags"), // Array of tags for filtering
  metadata: json("metadata"), // Author, version, date, etc.
  freshnessScore: decimal("freshnessScore", { precision: 3, scale: 2 }).default("1.00"), // 0.00-1.00, decays over time
  chunkCount: int("chunkCount").default(0),
  isProcessed: boolean("isProcessed").default(false),
  processingError: text("processingError"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeDoc = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeDoc = typeof knowledgeBase.$inferInsert;

// Chunk types for hierarchical retrieval
export const chunkTypeEnum = mysqlEnum("chunkType", [
  "document_summary", // Top-level document summary
  "section_summary",  // Section/chapter summary
  "content",          // Actual content chunk
  "table",            // Extracted table data
  "list",             // Extracted list/bullet points
  "quote"             // Important quotes or callouts
]);

// Document chunks with embeddings
export const documentChunks = mysqlTable("documentChunks", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  chunkType: chunkTypeEnum.default("content").notNull(),
  content: text("content").notNull(), // The actual chunk text
  sectionPath: varchar("sectionPath", { length: 500 }), // e.g., "Chapter 1 > Section 2 > Subsection A"
  sectionTitle: varchar("sectionTitle", { length: 255 }), // Current section title
  tokenCount: int("tokenCount"), // For context window management
  chunkIndex: int("chunkIndex"), // Order within document
  // Embedding stored as JSON array (MySQL doesn't have native vector type)
  // For production, consider using a vector DB like Pinecone or pgvector
  embedding: json("embedding"), // Array of floats
  embeddingModel: varchar("embeddingModel", { length: 100 }), // Which model generated it
  // Metadata for retrieval optimization
  parentChunkId: int("parentChunkId"), // For hierarchical retrieval
  importance: decimal("importance", { precision: 3, scale: 2 }).default("0.50"), // 0.00-1.00
  usageCount: int("usageCount").default(0), // How often this chunk is retrieved
  successScore: decimal("successScore", { precision: 3, scale: 2 }).default("0.50"), // Feedback loop score
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;

// Track which chunks were used in AI responses (for feedback loop)
export const chunkUsage = mysqlTable("chunkUsage", {
  id: int("id").autoincrement().primaryKey(),
  chunkId: int("chunkId").notNull(),
  usageContext: varchar("usageContext", { length: 50 }).notNull(), // 'outreach', 'insights', 'analysis', 'chat'
  entityType: varchar("entityType", { length: 50 }), // 'account', 'contact', 'call'
  entityId: int("entityId"),
  wasHelpful: boolean("wasHelpful"), // User feedback
  responseId: varchar("responseId", { length: 100 }), // To group chunks used in same response
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChunkUsage = typeof chunkUsage.$inferSelect;
export type InsertChunkUsage = typeof chunkUsage.$inferInsert;


// ==========================================
// USER HISTORY & MEMORY TABLES
// ==========================================

// Generated email history
export const emailHistory = mysqlTable("emailHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accountId: int("accountId"),
  contactId: int("contactId"),
  recipientEmail: varchar("recipientEmail", { length: 255 }),
  subject: varchar("subject", { length: 500 }),
  body: text("body"),
  context: text("context"), // User-provided context for generation
  attachmentNames: json("attachmentNames"), // Array of attachment filenames
  status: varchar("status", { length: 50 }).default("generated"), // generated, sent, draft
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailHistory = typeof emailHistory.$inferSelect;
export type InsertEmailHistory = typeof emailHistory.$inferInsert;

// AI Assistant chat history
export const chatHistory = mysqlTable("chatHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: varchar("sessionId", { length: 100 }).notNull(), // Group messages by session
  role: varchar("role", { length: 20 }).notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  // Context about what the user was viewing when they asked
  contextType: varchar("contextType", { length: 50 }), // 'account', 'contact', 'call', 'general'
  contextId: int("contextId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatHistory = typeof chatHistory.$inferSelect;
export type InsertChatHistory = typeof chatHistory.$inferInsert;

// User preferences and saved filters
export const userPreferences = mysqlTable("userPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Saved filter presets
  savedFilters: json("savedFilters"), // Array of {name, filters} objects
  // Default view preferences
  defaultRegion: varchar("defaultRegion", { length: 100 }),
  defaultIndustry: varchar("defaultIndustry", { length: 100 }),
  defaultSort: varchar("defaultSort", { length: 50 }).default("intentScore"),
  // Notification preferences
  notifyOnIntentSpike: boolean("notifyOnIntentSpike").default(true),
  notifyOnNewContact: boolean("notifyOnNewContact").default(false),
  // Recently viewed
  recentAccountIds: json("recentAccountIds"), // Array of account IDs
  recentContactIds: json("recentContactIds"), // Array of contact IDs
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;
