ALTER TABLE `users` ADD `status` enum('unverified','waitlist','active') DEFAULT 'unverified' NOT NULL;
--> statement-breakpoint
-- Backfill: existing users who already set a password are active users.
-- Users without a password never completed registration, so they remain 'unverified'.
UPDATE `users` SET `status` = 'active' WHERE `password_hash` IS NOT NULL;