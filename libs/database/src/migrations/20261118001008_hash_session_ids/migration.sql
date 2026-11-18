ALTER TABLE `sessions` MODIFY COLUMN `id` varchar(64) NOT NULL;
--> statement-breakpoint
UPDATE `sessions` SET `id` = SHA2(`id`, 256) WHERE CHAR_LENGTH(`id`) = 36;
