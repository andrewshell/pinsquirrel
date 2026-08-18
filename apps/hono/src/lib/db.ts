import { createDatabaseClient, createRepositories } from '@pinsquirrel/database'
import type { MySql2Database } from 'drizzle-orm/mysql2'

// Create database client
export const db: MySql2Database = createDatabaseClient(
  process.env.DATABASE_URL || 'mysql://localhost:3306/pinsquirrel'
)

// How the repositories compose is the database package's business, not ours.
export const {
  userRepository,
  tagRepository,
  pinRepository,
  passwordResetRepository,
  sessionRepository,
  apiKeyRepository,
} = createRepositories(db)
