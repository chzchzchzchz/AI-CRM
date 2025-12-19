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
