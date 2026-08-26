CREATE TABLE `oauth_authorization_codes` (
	`id` varchar(36) PRIMARY KEY,
	`code_hash` varchar(64) NOT NULL,
	`client_id` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`redirect_uri` varchar(512) NOT NULL,
	`code_challenge` varchar(128) NOT NULL,
	`scopes` json NOT NULL,
	`resource` varchar(255) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`consumed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `code_hash_unique` UNIQUE INDEX(`code_hash`)
);
--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`id` varchar(36) PRIMARY KEY,
	`client_id` varchar(255) NOT NULL,
	`client_name` varchar(255),
	`redirect_uris` json NOT NULL,
	`grant_types` json NOT NULL,
	`token_endpoint_auth_method` varchar(64) NOT NULL,
	`registration_type` enum('cimd','dcr','static') NOT NULL,
	`metadata_url` varchar(512),
	`metadata_fetched_at` timestamp(3),
	`completed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `client_id_unique` UNIQUE INDEX(`client_id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` varchar(36) PRIMARY KEY,
	`token_hash` varchar(64) NOT NULL,
	`kind` enum('access','refresh') NOT NULL,
	`client_id` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`scopes` json NOT NULL,
	`resource` varchar(255) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`revoked_at` timestamp(3),
	`rotated_at` timestamp(3),
	`rotated_from` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `token_hash_unique` UNIQUE INDEX(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `oauth_authorization_codes_expires_at_idx` ON `oauth_authorization_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `oauth_clients_incomplete_idx` ON `oauth_clients` (`registration_type`,`completed_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_expires_at_idx` ON `oauth_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_user_client_idx` ON `oauth_tokens` (`user_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_rotated_from_idx` ON `oauth_tokens` (`rotated_from`);--> statement-breakpoint
ALTER TABLE `oauth_authorization_codes` ADD CONSTRAINT `oauth_authorization_codes_dNKAO9Tc2g7T_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `oauth_authorization_codes` ADD CONSTRAINT `oauth_authorization_codes_user_id_users_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_client_id_oauth_clients_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_user_id_users_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;