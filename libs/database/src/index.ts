// Re-export drizzle as createDatabaseClient for stable API
export { drizzle as createDatabaseClient } from 'drizzle-orm/node-postgres'

// Repository implementations
export { DrizzleUserRepository } from './repositories/user.js'
export { DrizzlePinRepository } from './repositories/pin.js'
export { DrizzleTagRepository } from './repositories/tag.js'
export { DrizzlePasswordResetRepository } from './repositories/password-reset.js'