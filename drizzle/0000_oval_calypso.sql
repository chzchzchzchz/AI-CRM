CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clayRecordId` varchar(255),
	`clayTableId` varchar(255),
	`name` varchar(255) NOT NULL,
	`domain` varchar(255),
	`domainVariations` json,
	`industry` varchar(100),
	`employeeCount` int,
	`revenue` varchar(100),
	`location` varchar(255),
	`region` varchar(100),
	`intentScore` int DEFAULT 0,
	`relationship` varchar(50) DEFAULT 'Prospect',
	`description` text,
	`website` varchar(500),
	`linkedinUrl` varchar(500),
	`techStack` text,
	`securityStack` text,
	`triggerEvents` text,
	`rawData` json,
	`aiOverviewCache` text,
	`aiCacheUpdatedAt` timestamp,
	`sixsenseId` varchar(255),
	`sixsenseBuyingStage` varchar(100),
	`sixsenseProfileFit` varchar(100),
	`sixsenseSegments` text,
	`lastSixsenseSync` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_clayRecordId_unique` UNIQUE(`clayRecordId`)
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
CREATE TABLE `aiContext` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int,
	`contactId` int,
	`contextType` varchar(50) NOT NULL,
	`prompt` text,
	`response` text,
	`model` varchar(50),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiContext_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiInsights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int,
	`insightType` varchar(50) NOT NULL,
	`title` varchar(255),
	`content` text NOT NULL,
	`confidence` int,
	`source` varchar(50),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiInsights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int,
	`contactId` int,
	`title` varchar(255),
	`duration` int,
	`recordingUrl` varchar(500),
	`transcriptUrl` varchar(500),
	`gongCallId` varchar(255),
	`sentiment` varchar(50),
	`keyTopics` text,
	`actionItems` text,
	`callDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calls_id` PRIMARY KEY(`id`),
	CONSTRAINT `calls_gongCallId_unique` UNIQUE(`gongCallId`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`clayRecordId` varchar(255),
	`firstName` varchar(255),
	`lastName` varchar(255),
	`name` varchar(255),
	`title` varchar(255),
	`email` varchar(320),
	`phone` varchar(50),
	`linkedinUrl` varchar(500),
	`location` varchar(255),
	`department` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contacts_clayRecordId_unique` UNIQUE(`clayRecordId`)
);
--> statement-breakpoint
CREATE TABLE `contextStore` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(64) NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`metadata` text,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contextStore_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int,
	`contactId` int,
	`callId` int,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(500) NOT NULL,
	`fileType` varchar(100),
	`fileSize` int,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
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
CREATE TABLE `emailSequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`steps` json NOT NULL,
	`isActive` boolean DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailSequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrichmentLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int NOT NULL,
	`source` varchar(50) NOT NULL,
	`status` varchar(50) NOT NULL,
	`dataSnapshot` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrichmentLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intentScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`score` int NOT NULL,
	`category` varchar(100),
	`keywords` text,
	`source` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intentScores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int,
	`title` varchar(500) NOT NULL,
	`url` varchar(500),
	`source` varchar(255),
	`publishedAt` timestamp,
	`summary` text,
	`sentiment` varchar(50),
	`relevanceScore` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outreachCampaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`sequenceId` int,
	`accountIds` json,
	`contactIds` json,
	`status` varchar(50) NOT NULL,
	`startDate` timestamp,
	`endDate` timestamp,
	`stats` json,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outreachCampaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rfps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int,
	`title` varchar(500) NOT NULL,
	`description` text,
	`agency` varchar(255),
	`solicitationNumber` varchar(255),
	`postedDate` timestamp,
	`responseDeadline` timestamp,
	`awardAmount` varchar(100),
	`samGovId` varchar(255),
	`url` varchar(500),
	`status` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rfps_id` PRIMARY KEY(`id`),
	CONSTRAINT `rfps_solicitationNumber_unique` UNIQUE(`solicitationNumber`),
	CONSTRAINT `rfps_samGovId_unique` UNIQUE(`samGovId`)
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
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
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
