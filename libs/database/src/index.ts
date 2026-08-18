// Re-export drizzle as createDatabaseClient for stable API
export { drizzle as createDatabaseClient } from 'drizzle-orm/mysql2'

// Wired repository set — the usual way to build them
export { createRepositories, type Repositories } from './create-repositories.js'

// Repository implementations
export { DrizzleUserRepository } from './repositories/user.js'
export { DrizzlePinRepository } from './repositories/pin.js'
export { DrizzleTagRepository } from './repositories/tag.js'
export { DrizzlePasswordResetRepository } from './repositories/password-reset.js'
export { DrizzleSessionRepository } from './repositories/session.js'
export { DrizzleApiKeyRepository } from './repositories/api-key.js'
