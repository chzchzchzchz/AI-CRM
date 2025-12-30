CREATE TABLE `transcriptReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`transcript` text NOT NULL,
	`analysis` json NOT NULL,
	`accountId` int,
	`contactId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transcriptReports_id` PRIMARY KEY(`id`)
);
