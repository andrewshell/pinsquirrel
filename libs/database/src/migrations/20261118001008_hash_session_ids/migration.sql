ALTER TABLE `sessions` MODIFY COLUMN `id` varchar(64) NOT NULL;
--> statement-breakpoint
-- A session cookie now carries a token and the row is keyed by its SHA-256.
-- Existing rows are keyed by the UUID their cookie still holds, so key them by
-- its hash and nobody is signed out. A hashed id is 64 characters and a UUID
-- 36, so re-running this after a partial apply skips rows already done.
UPDATE `sessions` SET `id` = SHA2(`id`, 256) WHERE CHAR_LENGTH(`id`) = 36;
