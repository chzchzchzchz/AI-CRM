import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

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

export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  industry: varchar("industry", { length: 255 }),
  employeeCount: int("employeeCount"),
  revenue: varchar("revenue", { length: 100 }),
  location: text("location"),
  description: text("description"),
  website: varchar("website", { length: 500 }),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  
  // Enrichment data
  securityStack: text("securityStack"), // JSON array
  techStack: text("techStack"), // JSON array
  triggerEvents: text("triggerEvents"), // JSON array
  
  // Clay integration
  clayTableId: varchar("clayTableId", { length: 255 }),
  clayRecordId: varchar("clayRecordId", { length: 255 }),
  lastEnrichedAt: timestamp("lastEnrichedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  title: varchar("title", { length: 255 }),
  department: varchar("department", { length: 100 }),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  
  // Engagement tracking
  lastContactedAt: timestamp("lastContactedAt"),
  engagementScore: int("engagementScore"),
  
  // Clay integration
  clayRecordId: varchar("clayRecordId", { length: 255 }),
  lastEnrichedAt: timestamp("lastEnrichedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

export const intentScores = mysqlTable("intentScores", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  score: int("score").notNull(),
  category: varchar("category", { length: 100 }),
  keywords: text("keywords"), // JSON array
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  source: varchar("source", { length: 50 }).default("6sense"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntentScore = typeof intentScores.$inferSelect;
export type InsertIntentScore = typeof intentScores.$inferInsert;

export const calls = mysqlTable("calls", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId"),
  contactId: int("contactId"),
  title: varchar("title", { length: 255 }),
  duration: int("duration"), // seconds
  recordingUrl: varchar("recordingUrl", { length: 500 }),
  transcriptUrl: varchar("transcriptUrl", { length: 500 }),
  
  // Gong integration
  gongCallId: varchar("gongCallId", { length: 255 }),
  sentiment: varchar("sentiment", { length: 50 }),
  keyTopics: text("keyTopics"), // JSON array
  actionItems: text("actionItems"), // JSON array
  
  callDate: timestamp("callDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Call = typeof calls.$inferSelect;
export type InsertCall = typeof calls.$inferInsert;

export const rfps = mysqlTable("rfps", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  agency: varchar("agency", { length: 255 }),
  solicitationNumber: varchar("solicitationNumber", { length: 100 }),
  postedDate: timestamp("postedDate"),
  responseDeadline: timestamp("responseDeadline"),
  awardAmount: varchar("awardAmount", { length: 100 }),
  
  // SAM.gov integration
  samGovId: varchar("samGovId", { length: 255 }),
  url: varchar("url", { length: 500 }),
  status: varchar("status", { length: 50 }).default("active"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RFP = typeof rfps.$inferSelect;
export type InsertRFP = typeof rfps.$inferInsert;

export const enrichmentLogs = mysqlTable("enrichmentLogs", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 50 }).notNull(), // 'account' or 'contact'
  entityId: int("entityId").notNull(),
  source: varchar("source", { length: 50 }).notNull(), // 'clay', '6sense', 'gong', etc.
  status: varchar("status", { length: 50 }).notNull(),
  dataSnapshot: text("dataSnapshot"), // JSON
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EnrichmentLog = typeof enrichmentLogs.$inferSelect;
export type InsertEnrichmentLog = typeof enrichmentLogs.$inferInsert;

export const aiContext = mysqlTable("aiContext", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  contextType: varchar("contextType", { length: 50 }).notNull(), // 'research', 'outreach', 'summary'
  prompt: text("prompt"),
  response: text("response"),
  model: varchar("model", { length: 50 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIContext = typeof aiContext.$inferSelect;
export type InsertAIContext = typeof aiContext.$inferInsert;

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
