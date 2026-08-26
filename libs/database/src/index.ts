// Re-export drizzle as createDatabaseClient for stable API
export { drizzle as createDatabaseClient } from 'drizzle-orm/mysql2'
export type { MySql2Database as DatabaseClient } from 'drizzle-orm/mysql2'

// Raw SQL fragments, for the callers that legitimately need one (the health
// check). Re-exported so composition roots don't need a direct drizzle-orm
// dependency of their own.
export { sql } from 'drizzle-orm'

// Wired repository set — the usual way to build them
export { createRepositories, type Repositories } from './create-repositories.js'

// Repository implementations
export { DrizzleUserRepository } from './repositories/user.js'
export { DrizzlePinRepository } from './repositories/pin.js'
export { DrizzleTagRepository } from './repositories/tag.js'
export { DrizzlePasswordResetRepository } from './repositories/password-reset.js'
export { DrizzleSessionRepository } from './repositories/session.js'
export { DrizzleApiKeyRepository } from './repositories/api-key.js'
export { DrizzleOAuthClientRepository } from './repositories/oauth-client.js'
