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
