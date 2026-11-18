CREATE TABLE `email_changes` (
	`id` varchar(36) PRIMARY KEY,
	`user_id` varchar(36) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`email_hash` varchar(255) NOT NULL,
	`email_encrypted` text,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `user_id_unique` UNIQUE INDEX(`user_id`),
	CONSTRAINT `token_hash_unique` UNIQUE INDEX(`token_hash`),
	CONSTRAINT `email_changes_user_id_users_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
