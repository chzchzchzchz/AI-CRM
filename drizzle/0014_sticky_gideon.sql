CREATE TABLE `dust_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`query_hash` varchar(64) NOT NULL,
	`query` text NOT NULL,
	`result` text NOT NULL,
	`account_id` int,
	`contact_id` int,
	`created_at` timestamp DEFAULT (now()),
	`expires_at` timestamp,
	CONSTRAINT `dust_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `dust_cache_query_hash_unique` UNIQUE(`query_hash`)
);
--> statement-breakpoint
ALTER TABLE `contacts` MODIFY COLUMN `accountId` int;--> statement-breakpoint
CREATE INDEX `dust_cache_account_id` ON `dust_cache` (`account_id`);--> statement-breakpoint
CREATE INDEX `dust_cache_contact_id` ON `dust_cache` (`contact_id`);--> statement-breakpoint
CREATE INDEX `dust_cache_expires_at` ON `dust_cache` (`expires_at`);