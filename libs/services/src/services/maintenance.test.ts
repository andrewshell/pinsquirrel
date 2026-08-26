import { describe, it, expect, vi } from 'vitest'
import type {
  OAuthAuthorizationCodeRepository,
  OAuthClientRepository,
  OAuthTokenRepository,
  PasswordResetRepository,
  SessionRepository,
} from '@pinsquirrel/domain'
import { MaintenanceService } from './maintenance.js'

interface Counts {
  sessions: number
  tokens: number
  oauthCodes: number
  oauthTokens: number
  oauthClients: number
}

const nothing: Counts = {
  sessions: 0,
  tokens: 0,
  oauthCodes: 0,
  oauthTokens: 0,
  oauthClients: 0,
}

function makeRepositories(counts: Counts = nothing) {
  const sessionRepository = {
    deleteExpiredSessions: vi.fn().mockResolvedValue(counts.sessions),
  } as unknown as SessionRepository

  const passwordResetRepository = {
    deleteExpiredTokens: vi.fn().mockResolvedValue(counts.tokens),
  } as unknown as PasswordResetRepository

  const oauthClientRepository = {
    deleteExpiredIncompleteClients: vi
      .fn()
      .mockResolvedValue(counts.oauthClients),
  } as unknown as OAuthClientRepository

  const oauthCodeRepository = {
    deleteExpiredCodes: vi.fn().mockResolvedValue(counts.oauthCodes),
  } as unknown as OAuthAuthorizationCodeRepository

  const oauthTokenRepository = {
    deleteExpiredTokens: vi.fn().mockResolvedValue(counts.oauthTokens),
  } as unknown as OAuthTokenRepository

  return {
    sessionRepository,
    passwordResetRepository,
    oauthClientRepository,
    oauthCodeRepository,
    oauthTokenRepository,
  }
}

function makeService(counts: Counts = nothing) {
  const repositories = makeRepositories(counts)
  const service = new MaintenanceService(
    repositories.sessionRepository,
    repositories.passwordResetRepository,
    repositories.oauthClientRepository,
    repositories.oauthCodeRepository,
    repositories.oauthTokenRepository
  )
  return { service, ...repositories }
}

describe('MaintenanceService', () => {
  it('sweeps every store that accumulates expired rows', async () => {
    const ctx = makeService({
      sessions: 3,
      tokens: 2,
      oauthCodes: 7,
      oauthTokens: 11,
      oauthClients: 5,
    })

    const result = await ctx.service.sweepExpired()

    expect(ctx.sessionRepository.deleteExpiredSessions).toHaveBeenCalledOnce()
    expect(
      ctx.passwordResetRepository.deleteExpiredTokens
    ).toHaveBeenCalledOnce()
    expect(ctx.oauthCodeRepository.deleteExpiredCodes).toHaveBeenCalledOnce()
    expect(ctx.oauthTokenRepository.deleteExpiredTokens).toHaveBeenCalledOnce()
    expect(result).toEqual({
      sessions: 3,
      passwordResetTokens: 2,
      oauthAuthorizationCodes: 7,
      oauthTokens: 11,
      oauthClients: 5,
    })
  })

  // Anyone can create an `oauth_clients` row through dynamic registration, and
  // Claude registers afresh on every new connection, so a registration that
  // never authorized anybody has a deadline. The cutoff is the service's to
  // decide, which is why the repository takes it rather than computing it.
  it('sweeps dynamic registrations that never completed an authorization', async () => {
    const ctx = makeService()

    await ctx.service.sweepExpired()

    const cutoff = vi.mocked(
      ctx.oauthClientRepository.deleteExpiredIncompleteClients
    ).mock.calls[0][0]
    const age = Date.now() - cutoff.getTime()
    expect(age).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(age).toBeLessThan(25 * 60 * 60 * 1000)
  })

  // The counts are what the caller logs, so a sweep that removed nothing has
  // to be distinguishable from one that removed everything.
  it('reports nothing swept when nothing has expired', async () => {
    const ctx = makeService()

    expect(await ctx.service.sweepExpired()).toEqual({
      sessions: 0,
      passwordResetTokens: 0,
      oauthAuthorizationCodes: 0,
      oauthTokens: 0,
      oauthClients: 0,
    })
  })

  // One failing store must not leave the others unswept - and the caller has
  // to hear about it rather than being told the sweep succeeded.
  it('propagates a failure from one store', async () => {
    const ctx = makeService()
    vi.mocked(ctx.sessionRepository.deleteExpiredSessions).mockRejectedValue(
      new Error('connection reset')
    )

    await expect(ctx.service.sweepExpired()).rejects.toThrow('connection reset')
    expect(
      ctx.passwordResetRepository.deleteExpiredTokens
    ).toHaveBeenCalledOnce()
    expect(ctx.oauthTokenRepository.deleteExpiredTokens).toHaveBeenCalledOnce()
  })
})
