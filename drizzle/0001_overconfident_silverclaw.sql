CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`domain` varchar(255),
	`industry` varchar(255),
	`employeeCount` int,
	`revenue` varchar(100),
	`location` text,
	`description` text,
	`website` varchar(500),
	`linkedinUrl` varchar(500),
	`securityStack` text,
	`techStack` text,
	`triggerEvents` text,
	`clayTableId` varchar(255),
	`clayRecordId` varchar(255),
	`lastEnrichedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiContext` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`contextType` varchar(50) NOT NULL,
	`prompt` text,
	`response` text,
	`model` varchar(50),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiContext_id` PRIMARY KEY(`id`)
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
	CONSTRAINT `calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`firstName` varchar(100),
	`lastName` varchar(100),
	`email` varchar(320),
	`phone` varchar(50),
	`title` varchar(255),
	`department` varchar(100),
	`linkedinUrl` varchar(500),
	`lastContactedAt` timestamp,
	`engagementScore` int,
	`clayRecordId` varchar(255),
	`lastEnrichedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
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
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`source` varchar(50) DEFAULT '6sense',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intentScores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rfps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int,
	`title` varchar(500) NOT NULL,
	`description` text,
	`agency` varchar(255),
	`solicitationNumber` varchar(100),
	`postedDate` timestamp,
	`responseDeadline` timestamp,
	`awardAmount` varchar(100),
	`samGovId` varchar(255),
	`url` varchar(500),
	`status` varchar(50) DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rfps_id` PRIMARY KEY(`id`)
);
