ALTER TABLE `transcriptReports` MODIFY COLUMN `userId` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `transcriptReports` ADD `shareId` varchar(64) NOT NULL;