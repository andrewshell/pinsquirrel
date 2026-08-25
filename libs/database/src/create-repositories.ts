import type { MySql2Database } from 'drizzle-orm/mysql2'
import type {
  ApiKeyRepository,
  PasswordResetRepository,
  PinRepository,
  SessionRepository,
  TagRepository,
  UserRepository,
} from '@pinsquirrel/domain'
import { DrizzleApiKeyRepository } from './repositories/api-key.js'
import { DrizzlePasswordResetRepository } from './repositories/password-reset.js'
import { DrizzlePinRepository } from './repositories/pin.js'
import { DrizzleSessionRepository } from './repositories/session.js'
import { DrizzleTagRepository } from './repositories/tag.js'
import { DrizzleUserRepository } from './repositories/user.js'

export interface Repositories {
  userRepository: UserRepository
  tagRepository: TagRepository
  pinRepository: PinRepository
  passwordResetRepository: PasswordResetRepository
  sessionRepository: SessionRepository
  apiKeyRepository: ApiKeyRepository
}

/**
 * Every repository, wired to one database client.
 *
 * The individual classes stay exported for tests and for consumers that need
 * only one of them. This exists so nothing outside the package has to know how
 * they compose — the pin repository takes the tag repository, and a consumer
 * assembling them by hand has to know that and keep knowing it. Growing a
 * second such dependency should change this file and nothing else.
 */
export function createRepositories(db: MySql2Database): Repositories {
  const tagRepository = new DrizzleTagRepository(db)

  return {
    userRepository: new DrizzleUserRepository(db),
    tagRepository,
    // Reads and writes pins by tag name, so it resolves names through the
    // same tag repository returned above rather than a second instance. It
    // needs the Drizzle class specifically, not the `TagRepository`
    // interface — see its constructor for why.
    pinRepository: new DrizzlePinRepository(db, tagRepository),
    passwordResetRepository: new DrizzlePasswordResetRepository(db),
    sessionRepository: new DrizzleSessionRepository(db),
    apiKeyRepository: new DrizzleApiKeyRepository(db),
  }
}
