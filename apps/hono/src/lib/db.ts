import {
  createDatabaseClient,
  DrizzlePasswordResetRepository,
  DrizzlePinRepository,
  DrizzleSessionRepository,
  DrizzleTagRepository,
  DrizzleUserRepository,
} from '@pinsquirrel/database'

// Create database client
export const db = createDatabaseClient(
  process.env.DATABASE_URL || 'postgresql://localhost:5432/pinsquirrel'
)

// Create repository instances
export const userRepository = new DrizzleUserRepository(db)
export const tagRepository = new DrizzleTagRepository(db)
export const pinRepository = new DrizzlePinRepository(db, tagRepository)
export const passwordResetRepository = new DrizzlePasswordResetRepository(db)
export const sessionRepository = new DrizzleSessionRepository(db)
