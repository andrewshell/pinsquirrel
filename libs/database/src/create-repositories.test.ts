import { describe, it, expect } from 'vitest'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { createRepositories } from './create-repositories.js'
import { DrizzleApiKeyRepository } from './repositories/api-key.js'
import { DrizzlePasswordResetRepository } from './repositories/password-reset.js'
import { DrizzlePinRepository } from './repositories/pin.js'
import { DrizzleSessionRepository } from './repositories/session.js'
import { DrizzleTagRepository } from './repositories/tag.js'
import { DrizzleUserRepository } from './repositories/user.js'

// The constructors only store their arguments, so wiring can be checked
// without a database.
const db = {} as MySql2Database

describe('createRepositories', () => {
  it('returns every repository the app needs', () => {
    const repos = createRepositories(db)

    expect(repos.userRepository).toBeInstanceOf(DrizzleUserRepository)
    expect(repos.tagRepository).toBeInstanceOf(DrizzleTagRepository)
    expect(repos.pinRepository).toBeInstanceOf(DrizzlePinRepository)
    expect(repos.passwordResetRepository).toBeInstanceOf(
      DrizzlePasswordResetRepository
    )
    expect(repos.sessionRepository).toBeInstanceOf(DrizzleSessionRepository)
    expect(repos.apiKeyRepository).toBeInstanceOf(DrizzleApiKeyRepository)
  })

  // The whole point of the factory: the pin repository composes the tag
  // repository, and no consumer should have to know that to wire it up. It
  // needs the Drizzle class, not any `TagRepository` — the tag upsert it runs
  // inside its own transaction only exists there.
  it('gives the pin repository the same tag repository it returns', () => {
    const repos = createRepositories(db)

    const composed = (
      repos.pinRepository as unknown as { tagRepository: unknown }
    ).tagRepository

    expect(composed).toBe(repos.tagRepository)
    expect(composed).toBeInstanceOf(DrizzleTagRepository)
  })
})
