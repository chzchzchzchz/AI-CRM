DROP TABLE `aiChatHistory`;--> statement-breakpoint
DROP TABLE `aiResponseCache`;--> statement-breakpoint
DROP TABLE `dataProcessingJobs`;--> statement-breakpoint
DROP TABLE `documentChunks`;--> statement-breakpoint
DROP TABLE `emailHistory`;--> statement-breakpoint
DROP TABLE `generatedContent`;--> statement-breakpoint
DROP TABLE `knowledgeBase`;--> statement-breakpoint
DROP TABLE `sixsense6QA`;--> statement-breakpoint
DROP TABLE `sixsense6QAPerformance`;--> statement-breakpoint
DROP TABLE `sixsenseBuyingStageMetrics`;--> statement-breakpoint
DROP TABLE `sixsenseEngagementMetrics`;--> statement-breakpoint
DROP TABLE `sixsenseKeywords`;--> statement-breakpoint
DROP TABLE `transcriptReports`;--> statement-breakpoint
DROP TABLE `userInteractions`;--> statement-breakpoint
DROP TABLE `validationCache`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `aiInsightsCache`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `aiResearchCache`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `sixsenseId`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `sixsenseBuyingStage`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `sixsenseProfileFit`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `sixsenseSegments`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `lastSixsenseSync`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `sfdcAccountId`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `sfdcContactId`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `mobilePhone`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `directPhone`;