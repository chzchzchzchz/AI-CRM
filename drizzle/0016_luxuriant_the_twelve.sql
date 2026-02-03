CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountId` int,
	`contactId` int,
	`type` enum('email','call','note','meeting','task','sequence','rfp','other') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`duration` int,
	`sentiment` varchar(50),
	`outcome` varchar(255),
	`nextSteps` text,
	`attachments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `buyingCommittee` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`contactId` int NOT NULL,
	`role` enum('champion','decision_maker','influencer','blocker','other') NOT NULL,
	`influence` enum('high','medium','low') DEFAULT 'medium',
	`engagementLevel` enum('not_engaged','aware','interested','evaluating','champion') DEFAULT 'aware',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buyingCommittee_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountId` int,
	`contactId` int,
	`title` varchar(500) NOT NULL,
	`description` text,
	`status` enum('open','in_progress','completed','cancelled') NOT NULL DEFAULT 'open',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`dueDate` timestamp,
	`completedAt` timestamp,
	`assignedTo` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
