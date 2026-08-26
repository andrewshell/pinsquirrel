import { createDatabaseClient, createRepositories } from '@pinsquirrel/database'
import type { DatabaseClient } from '@pinsquirrel/database'

// Create database client
export const db: DatabaseClient = createDatabaseClient(
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
  oauthClientRepository,
  oauthAuthorizationCodeRepository,
  oauthTokenRepository,
} = createRepositories(db)
