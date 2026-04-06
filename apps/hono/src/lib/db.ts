import {
  createDatabaseClient,
  DrizzleApiKeyRepository,
  DrizzlePasswordResetRepository,
  DrizzlePinRepository,
  DrizzleSessionRepository,
  DrizzleTagRepository,
  DrizzleUserRepository,
} from '@pinsquirrel/database'
import type { MySql2Database } from 'drizzle-orm/mysql2'

// Create database client
export const db: MySql2Database = createDatabaseClient(
  process.env.DATABASE_URL || 'mysql://localhost:3306/pinsquirrel'
)

// Create repository instances
export const userRepository = new DrizzleUserRepository(db)
export const tagRepository = new DrizzleTagRepository(db)
export const pinRepository = new DrizzlePinRepository(db, tagRepository)
export const passwordResetRepository = new DrizzlePasswordResetRepository(db)
export const sessionRepository = new DrizzleSessionRepository(db)
export const apiKeyRepository = new DrizzleApiKeyRepository(db)
