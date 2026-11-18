-- One additive statement: it either ran or it did not. An old container
-- never selects the column, and a rollback leaves it in place, unused.
ALTER TABLE `oauth_tokens` ADD `granted_at` timestamp(3);