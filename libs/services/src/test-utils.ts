import type {
  AuthorizationCode,
  CreateAuthorizationCodeData,
  CreateOAuthTokenData,
  OAuthAuthorizationCodeRepository,
  OAuthToken,
  OAuthTokenRepository,
  UserRepository,
} from '@pinsquirrel/domain'
import { vi } from 'vitest'

/**
 * A `UserRepository` whose every method is an unconfigured `vi.fn()`.
 *
 * Four service test files used to spell this object out; when the interface
 * gains a method they all had to be edited, and a missing one only showed up
 * as a type error in whichever file was touched next.
 */
export function createMockUserRepository(): UserRepository {
  return {
    findById: vi.fn(),
    findByEmailHash: vi.fn(),
    findByUsername: vi.fn(),
    findByStatus: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    countByRole: vi.fn(),
    replacePasswordHash: vi.fn(),
    deleteStaleUnverified: vi.fn(),
    revokeSessionsAndTokens: vi.fn(),
  }
}

export function createDeferQueue() {
  const pending: Promise<void>[] = []
  return {
    defer: (work: () => Promise<void>) => {
      const run = work()
      run.catch(() => undefined)
      pending.push(run)
    },
    flush: async () => {
      while (pending.length > 0) {
        await Promise.all(pending.splice(0))
      }
    },
  }
}

/**
 * The OAuth code and token repositories over two arrays, with the same
 * conditional writes as the MySQL ones.
 *
 * A test seeds `codes` and `tokens`, calls the service, and asserts on what
 * is live afterwards. Every method yields to the event loop first, so two
 * concurrent service calls interleave the way two requests do. The methods
 * are `vi.fn`s, so one can still be made to fail.
 */
export function createInMemoryOAuthStore() {
  const codes: AuthorizationCode[] = []
  const tokens: OAuthToken[] = []
  let issued = 0
  const tick = () => new Promise<void>(resolve => setImmediate(resolve))
  const revokeWhere = (matches: (token: OAuthToken) => boolean) => {
    const live = tokens.filter(token => !token.revokedAt && matches(token))
    for (const token of live) token.revokedAt = new Date()
    return live.length
  }

  const codeRepository: OAuthAuthorizationCodeRepository = {
    findById: vi.fn(async id => {
      await tick()
      return codes.find(code => code.id === id) ?? null
    }),
    findByCodeHash: vi.fn(async hash => {
      await tick()
      return codes.find(code => code.codeHash === hash) ?? null
    }),
    create: vi.fn(async (data: CreateAuthorizationCodeData) => {
      await tick()
      const code: AuthorizationCode = {
        id: `code-${String(++issued)}`,
        consumedAt: null,
        createdAt: new Date(),
        ...data,
      }
      codes.push(code)
      return code
    }),
    consume: vi.fn(async hash => {
      await tick()
      const code = codes.find(
        candidate =>
          candidate.codeHash === hash &&
          !candidate.consumedAt &&
          candidate.expiresAt > new Date()
      )
      if (!code) return null
      code.consumedAt = new Date()
      return { ...code }
    }),
    delete: vi.fn(),
    deleteExpiredCodes: vi.fn(),
  }

  const tokenRepository: OAuthTokenRepository = {
    findById: vi.fn(async id => {
      await tick()
      return tokens.find(token => token.id === id) ?? null
    }),
    findByTokenHash: vi.fn(async hash => {
      await tick()
      return tokens.find(token => token.tokenHash === hash) ?? null
    }),
    findActiveByUserId: vi.fn(async userId => {
      await tick()
      return tokens.filter(
        token =>
          token.userId === userId &&
          !token.revokedAt &&
          !token.rotatedAt &&
          token.expiresAt > new Date()
      )
    }),
    create: vi.fn(async (data: CreateOAuthTokenData) => {
      await tick()
      const token: OAuthToken = {
        id: `token-${String(++issued)}`,
        revokedAt: null,
        rotatedAt: null,
        createdAt: new Date(),
        ...data,
        rotatedFrom: data.rotatedFrom ?? null,
      }
      tokens.push(token)
      return token
    }),
    revoke: vi.fn(async id => {
      await tick()
      return revokeWhere(token => token.id === id) > 0
    }),
    revokeByUserAndClient: vi.fn(async (userId, clientId) => {
      await tick()
      return revokeWhere(
        token => token.userId === userId && token.clientId === clientId
      )
    }),
    revokeByGrant: vi.fn(async (userId, grantId) => {
      await tick()
      return revokeWhere(
        token => token.userId === userId && token.grantId === grantId
      )
    }),
    markRotated: vi.fn(async id => {
      await tick()
      const token = tokens.find(
        candidate =>
          candidate.id === id && !candidate.rotatedAt && !candidate.revokedAt
      )
      if (!token) return false
      token.rotatedAt = new Date()
      return true
    }),
    deleteExpiredTokens: vi.fn(),
  }

  return { codes, tokens, codeRepository, tokenRepository }
}
