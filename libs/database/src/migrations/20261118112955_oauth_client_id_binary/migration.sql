-- The referencing columns must share the referenced column's collation, and
-- MySQL refuses to change one side of a foreign key at a time, so the checks
-- are off across the three changes.
SET FOREIGN_KEY_CHECKS = 0;--> statement-breakpoint
ALTER TABLE `oauth_clients` MODIFY COLUMN `client_id` varchar(255) COLLATE utf8mb4_bin NOT NULL;--> statement-breakpoint
ALTER TABLE `oauth_authorization_codes` MODIFY COLUMN `client_id` varchar(255) COLLATE utf8mb4_bin NOT NULL;--> statement-breakpoint
ALTER TABLE `oauth_tokens` MODIFY COLUMN `client_id` varchar(255) COLLATE utf8mb4_bin NOT NULL;--> statement-breakpoint
SET FOREIGN_KEY_CHECKS = 1;
