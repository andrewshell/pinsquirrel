-- Additive statements first. MySQL has no ADD COLUMN IF NOT EXISTS and DDL
-- does not roll back, so a run that stops partway is finished by hand; the
-- statement that only removes something goes last.
ALTER TABLE `oauth_authorization_codes` ADD `grant_id` varchar(36);--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD `grant_id` varchar(36);--> statement-breakpoint
CREATE INDEX `oauth_tokens_grant_idx` ON `oauth_tokens` (`grant_id`);--> statement-breakpoint
DROP INDEX `oauth_tokens_rotated_from_idx` ON `oauth_tokens`;
