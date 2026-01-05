DROP TABLE `access_requests`;--> statement-breakpoint
DROP TABLE `auditLogs`;--> statement-breakpoint
DROP TABLE `email_verification_codes`;--> statement-breakpoint
DROP TABLE `password_reset_codes`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `passwordHash`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `isApproved`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `twoFactorEnabled`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `twoFactorSecret`;