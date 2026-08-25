-- Runs once, on first initialisation of the mysql volume in
-- docker-compose.dev.yml. `libs/database`'s tests connect to
-- pinsquirrel_test (see src/test-setup.ts) and drop/recreate every table,
-- so it must exist alongside the dev database and be writable by the same
-- unprivileged user the app uses. CI creates it via the service
-- container's MYSQL_DATABASE instead, so this file is dev-only.
CREATE DATABASE IF NOT EXISTS pinsquirrel_test;
GRANT ALL PRIVILEGES ON pinsquirrel_test.* TO 'pinsquirrel'@'%';
FLUSH PRIVILEGES;
