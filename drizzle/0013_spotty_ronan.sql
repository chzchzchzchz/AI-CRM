CREATE TABLE `access_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255) NOT NULL,
	`company` varchar(255),
	`reason` text,
	`status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiChatHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`role` varchar(20) NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiChatHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiResponseCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queryHash` varchar(64) NOT NULL,
	`query` text NOT NULL,
	`contextHash` varchar(64),
	`answer` text NOT NULL,
	`reasoning` text,
	`model` varchar(50),
	`hitCount` int DEFAULT 1,
	`lastHitAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiResponseCache_id` PRIMARY KEY(`id`),
	CONSTRAINT `aiResponseCache_queryHash_unique` UNIQUE(`queryHash`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`description` text NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`metadata` json,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dataProcessingJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobType` varchar(100) NOT NULL,
	`status` varchar(50) DEFAULT 'pending',
	`inputFileKey` varchar(500),
	`inputFileUrl` varchar(1000),
	`outputFileKey` varchar(500),
	`outputFileUrl` varchar(1000),
	`recordsTotal` int DEFAULT 0,
	`recordsProcessed` int DEFAULT 0,
	`recordsSuccess` int DEFAULT 0,
	`recordsFailed` int DEFAULT 0,
	`errorLog` json,
	`fieldMappings` json,
	`transformRules` json,
	`learnings` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dataProcessingJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` text NOT NULL,
	`embedding` json,
	`metadata` json,
	`tokenCount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountId` int,
	`contactId` int,
	`recipientEmail` varchar(320),
	`subject` varchar(500),
	`body` text,
	`attachments` json,
	`status` varchar(50) DEFAULT 'generated',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_verification_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(6) NOT NULL,
	`email` varchar(320) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`attempts` int DEFAULT 0,
	`verified` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_verification_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generatedContent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contentType` varchar(100) NOT NULL,
	`title` varchar(500),
	`content` text NOT NULL,
	`ragSourceIds` json,
	`accountId` int,
	`contactId` int,
	`promptUsed` text,
	`userEdits` text,
	`feedback` varchar(50),
	`outcome` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generatedContent_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeBase` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`category` varchar(100),
	`status` varchar(50) DEFAULT 'processing',
	`chunkCount` int DEFAULT 0,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledgeBase_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`email` varchar(320) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`used` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sixsense6QA` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountName` varchar(255) NOT NULL,
	`sixsenseId` varchar(64),
	`crmAccountId` varchar(64),
	`dateCreated` timestamp,
	`responseTimeDays` int DEFAULT 0,
	`lastActiveDaysAgo` int DEFAULT 0,
	`salesActivities` int DEFAULT 0,
	`reachedContacts` int DEFAULT 0,
	`owner` varchar(255),
	`domain` varchar(255),
	`country` varchar(100),
	`isWorked` boolean DEFAULT false,
	`dataAsOf` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sixsense6QA_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sixsense6QAPerformance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` timestamp NOT NULL,
	`total6QAs` int DEFAULT 0,
	`new6QAs` int DEFAULT 0,
	`worked` int DEFAULT 0,
	`unworked` int DEFAULT 0,
	`avgSalesActivities` decimal(5,1),
	`avgContactsReached` decimal(5,1),
	`avgDaysToFirstActivity` decimal(5,1),
	`avgDaysSinceLastActivity` decimal(5,1),
	`dataAsOf` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sixsense6QAPerformance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sixsenseBuyingStageMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timeframe` varchar(100) NOT NULL,
	`buyingStage` varchar(50) NOT NULL,
	`numberOfAccounts` int DEFAULT 0,
	`newPipelineUSD` decimal(15,2),
	`totalWonUSD` decimal(15,2),
	`dataAsOf` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sixsenseBuyingStageMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sixsenseEngagementMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timeWindow` varchar(100) NOT NULL,
	`engagementState` varchar(100) NOT NULL,
	`accounts` int DEFAULT 0,
	`amountUSD` decimal(15,2),
	`dataAsOf` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sixsenseEngagementMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sixsenseKeywords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(255) NOT NULL,
	`totalAccounts` int DEFAULT 0,
	`accountsWithWebVisits` int DEFAULT 0,
	`accountsWith6QA` int DEFAULT 0,
	`accountsWithOpportunities` int DEFAULT 0,
	`accountsWithRelevantOpportunities` int DEFAULT 0,
	`category` varchar(100),
	`dataAsOf` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sixsenseKeywords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transcriptReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL DEFAULT 0,
	`name` varchar(255) NOT NULL,
	`transcript` text NOT NULL,
	`analysis` json NOT NULL,
	`accountId` int,
	`contactId` int,
	`shareId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transcriptReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userInteractions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`actionType` varchar(100) NOT NULL,
	`inputData` json,
	`outputData` json,
	`feedback` varchar(50),
	`feedbackDetails` text,
	`contextUsed` json,
	`accountId` int,
	`contactId` int,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userInteractions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `validationCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int NOT NULL,
	`field` varchar(100) NOT NULL,
	`isValid` boolean NOT NULL,
	`severity` varchar(20),
	`issue` text,
	`suggestion` text,
	`evidence` text,
	`confidence` decimal(3,2),
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `validationCache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `aiInsightsCache` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `aiResearchCache` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `sixsenseId` varchar(255);--> statement-breakpoint
ALTER TABLE `accounts` ADD `sixsenseBuyingStage` varchar(100);--> statement-breakpoint
ALTER TABLE `accounts` ADD `sixsenseProfileFit` varchar(100);--> statement-breakpoint
ALTER TABLE `accounts` ADD `sixsenseSegments` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `lastSixsenseSync` timestamp;--> statement-breakpoint
ALTER TABLE `accounts` ADD `sfdcAccountId` varchar(18);--> statement-breakpoint
ALTER TABLE `contacts` ADD `sfdcContactId` varchar(18);--> statement-breakpoint
ALTER TABLE `contacts` ADD `mobilePhone` varchar(50);--> statement-breakpoint
ALTER TABLE `contacts` ADD `directPhone` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `isApproved` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorEnabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorSecret` varchar(255);