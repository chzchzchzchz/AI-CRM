import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, varchar, text, mysqlEnum, timestamp, json, decimal, index, longtext } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"
import { tinyint } from "drizzle-orm/mysql-core"

export const accessRequests = mysqlTable("access_requests", {
	id: int().autoincrement().notNull(),
	email: varchar({ length: 320 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	company: varchar({ length: 255 }),
	reason: text(),
	status: mysqlEnum(['pending','approved','denied']).default('pending').notNull(),
	reviewedBy: int(),
	reviewedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const accounts = mysqlTable("accounts", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	domain: varchar({ length: 255 }),
	industry: varchar({ length: 255 }),
	employeeCount: int(),
	revenue: varchar({ length: 100 }),
	location: text(),
	description: text(),
	website: varchar({ length: 500 }),
	linkedinUrl: varchar({ length: 500 }),
	securityStack: text(),
	techStack: text(),
	triggerEvents: text(),
	clayTableId: varchar({ length: 255 }),
	clayRecordId: varchar({ length: 255 }),
	lastEnrichedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	region: varchar({ length: 100 }),
	intentScore: int().default(0),
	relationship: varchar({ length: 50 }).default('Prospect'),
	rawData: json(),
	domainVariations: json(),
	aiOverviewCache: text(),
	aiCacheUpdatedAt: timestamp({ mode: 'string' }),
	sixsenseId: varchar({ length: 255 }),
	sixsenseBuyingStage: varchar({ length: 100 }),
	sixsenseProfileFit: varchar({ length: 100 }),
	sixsenseSegments: text(),
	lastSixsenseSync: timestamp({ mode: 'string' }),
	linkedinCompanyUrl: varchar({ length: 512 }),
	linkedinCompanyId: varchar({ length: 64 }),
	salesNavUrl: varchar({ length: 512 }),
	sfdcAccountId: varchar({ length: 50 }),
	aiInsightsCache: text(),
	aiResearchCache: text(),
	phone: varchar({ length: 50 }),
	type: varchar({ length: 100 }),
});

export const aiChatHistory = mysqlTable("aiChatHistory", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	sessionId: varchar({ length: 64 }).notNull(),
	role: varchar({ length: 20 }).notNull(),
	content: text().notNull(),
	metadata: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const aiContext = mysqlTable("aiContext", {
	id: int().autoincrement().notNull(),
	accountId: int().notNull(),
	contextType: varchar({ length: 50 }).notNull(),
	prompt: text(),
	response: text(),
	model: varchar({ length: 50 }),
	createdBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const aiInsights = mysqlTable("aiInsights", {
	id: int().autoincrement().notNull(),
	accountId: int(),
	contactId: int(),
	insightType: varchar({ length: 100 }),
	content: text(),
	confidence: decimal({ precision: 3, scale: 2 }),
	metadata: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
});

export const aiResponseCache = mysqlTable("aiResponseCache", {
	id: int().autoincrement().notNull(),
	queryHash: varchar({ length: 64 }).notNull(),
	query: text().notNull(),
	contextHash: varchar({ length: 64 }),
	answer: text().notNull(),
	reasoning: text(),
	model: varchar({ length: 50 }),
	hitCount: int().default(1),
	lastHitAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("aiResponseCache_queryHash_unique").on(table.queryHash),
]);

export const auditLogs = mysqlTable("auditLogs", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	eventType: varchar({ length: 100 }).notNull(),
	description: text(),
	ipAddress: varchar({ length: 50 }),
	userAgent: text(),
	metadata: json(),
	timestamp: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("idx_userId").on(table.userId),
	index("idx_eventType").on(table.eventType),
]);

export const calls = mysqlTable("calls", {
	id: int().autoincrement().notNull(),
	accountId: int(),
	contactId: int(),
	title: varchar({ length: 255 }),
	duration: int(),
	recordingUrl: varchar({ length: 500 }),
	transcriptUrl: text(),
	gongCallId: varchar({ length: 255 }),
	sentiment: varchar({ length: 50 }),
	keyTopics: text(),
	actionItems: text(),
	callDate: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const contacts = mysqlTable("contacts", {
	id: int().autoincrement().notNull(),
	accountId: int(),
	firstName: varchar({ length: 100 }),
	lastName: varchar({ length: 100 }),
	email: varchar({ length: 320 }),
	phone: varchar({ length: 50 }),
	title: varchar({ length: 255 }),
	department: varchar({ length: 100 }),
	linkedinUrl: varchar({ length: 500 }),
	lastContactedAt: timestamp({ mode: 'string' }),
	engagementScore: int(),
	clayRecordId: varchar({ length: 255 }),
	lastEnrichedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	name: varchar({ length: 255 }),
	location: varchar({ length: 500 }),
	source: varchar({ length: 100 }),
	followscompany: tinyint().default(0),
	sixsenseMid: varchar({ length: 100 }),
	profileFit: varchar({ length: 50 }),
	profileScore: int(),
	engagementGrade: varchar({ length: 10 }),
	engagementTrend: varchar({ length: 50 }),
	personaImportance: varchar({ length: 50 }),
	engagementActivities: int(),
	salesActivities: int(),
	daysSinceLastEngagement: int(),
	daysSinceLastSalesActivity: int(),
	lastSalesActivity: varchar({ length: 255 }),
	lastEngagementActivity: varchar({ length: 255 }),
	city: varchar({ length: 100 }),
	state: varchar({ length: 100 }),
	country: varchar({ length: 100 }),
	sfdcContactId: varchar({ length: 18 }),
	mobilePhone: varchar({ length: 50 }),
	directPhone: varchar({ length: 50 }),
});

export const contextStore = mysqlTable("contextStore", {
	id: int().autoincrement().notNull(),
	type: varchar({ length: 64 }).notNull(),
	key: varchar({ length: 255 }).notNull(),
	value: text().notNull(),
	metadata: text(),
	userId: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const dataProcessingJobs = mysqlTable("dataProcessingJobs", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	jobType: varchar({ length: 100 }).notNull(),
	status: varchar({ length: 50 }).default('pending'),
	inputFileKey: varchar({ length: 500 }),
	inputFileUrl: varchar({ length: 1000 }),
	outputFileKey: varchar({ length: 500 }),
	outputFileUrl: varchar({ length: 1000 }),
	recordsTotal: int().default(0),
	recordsProcessed: int().default(0),
	recordsSuccess: int().default(0),
	recordsFailed: int().default(0),
	errorLog: json(),
	fieldMappings: json(),
	transformRules: json(),
	learnings: json(),
	startedAt: timestamp({ mode: 'string' }),
	completedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const documentChunks = mysqlTable("documentChunks", {
	id: int().autoincrement().notNull(),
	documentId: int().notNull(),
	chunkIndex: int().notNull(),
	content: text().notNull(),
	embedding: json(),
	metadata: json(),
	tokenCount: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const documents = mysqlTable("documents", {
	id: int().autoincrement().notNull(),
	accountId: int(),
	contactId: int(),
	callId: int(),
	fileName: varchar({ length: 255 }).notNull(),
	fileKey: varchar({ length: 500 }).notNull(),
	fileUrl: varchar({ length: 500 }).notNull(),
	fileType: varchar({ length: 100 }),
	fileSize: int(),
	uploadedBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const dustCache = mysqlTable("dust_cache", {
	id: int().autoincrement().notNull(),
	queryHash: varchar("query_hash", { length: 64 }).notNull(),
	query: text().notNull(),
	result: longtext().notNull(),
	accountId: int("account_id"),
	contactId: int("contact_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
},
(table) => [
	index("dust_cache_account_id").on(table.accountId),
	index("dust_cache_contact_id").on(table.contactId),
	index("dust_cache_expires_at").on(table.expiresAt),
	index("query_hash").on(table.queryHash),
]);

export const emailHistory = mysqlTable("emailHistory", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	accountId: int(),
	contactId: int(),
	recipientEmail: varchar({ length: 320 }),
	subject: varchar({ length: 500 }),
	body: text(),
	attachments: json(),
	status: varchar({ length: 50 }).default('generated'),
	sentAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const emailSequences = mysqlTable("emailSequences", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	steps: json(),
	status: varchar({ length: 50 }).default('draft'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
});

// Removed duplicate emailVerificationCodes - already defined below

export const emailVerificationCodes = mysqlTable("email_verification_codes", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	code: varchar({ length: 6 }).notNull(),
	email: varchar({ length: 320 }).notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	attempts: int().default(0),
	verified: tinyint().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const enrichmentLogs = mysqlTable("enrichmentLogs", {
	id: int().autoincrement().notNull(),
	entityType: varchar({ length: 50 }).notNull(),
	entityId: int().notNull(),
	source: varchar({ length: 50 }).notNull(),
	status: varchar({ length: 50 }).notNull(),
	dataSnapshot: text(),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const generatedContent = mysqlTable("generatedContent", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	contentType: varchar({ length: 100 }).notNull(),
	title: varchar({ length: 500 }),
	content: text().notNull(),
	ragSourceIds: json(),
	accountId: int(),
	contactId: int(),
	promptUsed: text(),
	userEdits: text(),
	feedback: varchar({ length: 50 }),
	outcome: varchar({ length: 100 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const intentScores = mysqlTable("intentScores", {
	id: int().autoincrement().notNull(),
	accountId: int().notNull(),
	score: int().notNull(),
	category: varchar({ length: 100 }),
	keywords: text(),
	timestamp: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	source: varchar({ length: 50 }).default('6sense'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const knowledgeBase = mysqlTable("knowledgeBase", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	fileName: varchar({ length: 500 }).notNull(),
	fileKey: varchar({ length: 500 }).notNull(),
	fileUrl: varchar({ length: 1000 }).notNull(),
	mimeType: varchar({ length: 100 }),
	fileSize: int(),
	category: varchar({ length: 100 }),
	status: varchar({ length: 50 }).default('processing'),
	chunkCount: int().default(0),
	metadata: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const newsItems = mysqlTable("newsItems", {
	id: int().autoincrement().notNull(),
	accountId: int(),
	title: varchar({ length: 500 }),
	summary: text(),
	url: varchar({ length: 1000 }),
	source: varchar({ length: 255 }),
	publishedAt: timestamp({ mode: 'string' }),
	relevanceScore: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const outreachCampaigns = mysqlTable("outreachCampaigns", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	sequenceId: int(),
	accountIds: json(),
	contactIds: json(),
	status: varchar({ length: 50 }).default('draft'),
	metrics: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
});

// Removed duplicate passwordResetCodes - already defined below

export const passwordResetCodes = mysqlTable("password_reset_codes", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	code: varchar({ length: 32 }).notNull(),
	email: varchar({ length: 320 }).notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	used: tinyint().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const rfps = mysqlTable("rfps", {
	id: int().autoincrement().notNull(),
	accountId: int(),
	title: varchar({ length: 500 }).notNull(),
	description: text(),
	agency: varchar({ length: 255 }),
	solicitationNumber: varchar({ length: 100 }),
	postedDate: timestamp({ mode: 'string' }),
	responseDeadline: timestamp({ mode: 'string' }),
	awardAmount: varchar({ length: 100 }),
	samGovId: varchar({ length: 255 }),
	url: varchar({ length: 500 }),
	status: varchar({ length: 50 }).default('active'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const sixsense6Qa = mysqlTable("sixsense6QA", {
	id: int().autoincrement().notNull(),
	accountName: varchar({ length: 255 }).notNull(),
	sixsenseId: varchar({ length: 64 }),
	crmAccountId: varchar({ length: 64 }),
	dateCreated: timestamp({ mode: 'string' }),
	responseTimeDays: int().default(0),
	lastActiveDaysAgo: int().default(0),
	salesActivities: int().default(0),
	reachedContacts: int().default(0),
	owner: varchar({ length: 255 }),
	domain: varchar({ length: 255 }),
	country: varchar({ length: 100 }),
	isWorked: tinyint().default(0),
	dataAsOf: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
});

export const sixsense6QaPerformance = mysqlTable("sixsense6QAPerformance", {
	id: int().autoincrement().notNull(),
	day: timestamp({ mode: 'string' }).notNull(),
	total6QAs: int().default(0),
	new6QAs: int().default(0),
	worked: int().default(0),
	unworked: int().default(0),
	avgSalesActivities: decimal({ precision: 5, scale: 1 }),
	avgContactsReached: decimal({ precision: 5, scale: 1 }),
	avgDaysToFirstActivity: decimal({ precision: 5, scale: 1 }),
	avgDaysSinceLastActivity: decimal({ precision: 5, scale: 1 }),
	dataAsOf: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const sixsenseBuyingStageMetrics = mysqlTable("sixsenseBuyingStageMetrics", {
	id: int().autoincrement().notNull(),
	timeframe: varchar({ length: 100 }).notNull(),
	buyingStage: varchar({ length: 50 }).notNull(),
	numberOfAccounts: int().default(0),
	newPipelineUsd: decimal({ precision: 15, scale: 2 }),
	totalWonUsd: decimal({ precision: 15, scale: 2 }),
	dataAsOf: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const sixsenseEngagementMetrics = mysqlTable("sixsenseEngagementMetrics", {
	id: int().autoincrement().notNull(),
	timeWindow: varchar({ length: 100 }).notNull(),
	engagementState: varchar({ length: 100 }).notNull(),
	accounts: int().default(0),
	amountUsd: decimal({ precision: 15, scale: 2 }),
	dataAsOf: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const sixsenseKeywords = mysqlTable("sixsenseKeywords", {
	id: int().autoincrement().notNull(),
	keyword: varchar({ length: 255 }).notNull(),
	totalAccounts: int().default(0),
	accountsWithWebVisits: int().default(0),
	accountsWith6Qa: int().default(0),
	accountsWithOpportunities: int().default(0),
	accountsWithRelevantOpportunities: int().default(0),
	category: varchar({ length: 100 }),
	dataAsOf: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const transcriptReports = mysqlTable("transcriptReports", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	transcript: text().notNull(),
	analysis: json().notNull(),
	accountId: int(),
	contactId: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
	shareId: varchar({ length: 64 }).notNull(),
});

export const userInteractions = mysqlTable("userInteractions", {
	id: int().autoincrement().notNull(),
	userId: int(),
	sessionId: varchar({ length: 64 }),
	actionType: varchar({ length: 100 }).notNull(),
	inputData: json(),
	outputData: json(),
	feedback: varchar({ length: 50 }),
	feedbackDetails: text(),
	contextUsed: json(),
	accountId: int(),
	contactId: int(),
	durationMs: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['user','admin']).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	passwordHash: varchar({ length: 255 }),
	isApproved: tinyint().default(0),
	twoFactorEnabled: tinyint().default(0),
	twoFactorSecret: varchar({ length: 255 }),
},
(table) => [
	index("users_openId_unique").on(table.openId),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const validationCache = mysqlTable("validationCache", {
	id: int().autoincrement().notNull(),
	cacheKey: varchar({ length: 255 }).notNull(),
	data: json(),
	expiresAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("cacheKey").on(table.cacheKey),
]);
