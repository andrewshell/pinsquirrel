import { describe, it, expect, vi } from 'vitest'
import type {
  PasswordResetRepository,
  SessionRepository,
} from '@pinsquirrel/domain'
import { MaintenanceService } from './maintenance.js'

function makeRepositories(counts = { sessions: 0, tokens: 0 }) {
  const sessionRepository = {
    deleteExpiredSessions: vi.fn().mockResolvedValue(counts.sessions),
  } as unknown as SessionRepository

  const passwordResetRepository = {
    deleteExpiredTokens: vi.fn().mockResolvedValue(counts.tokens),
  } as unknown as PasswordResetRepository

  return { sessionRepository, passwordResetRepository }
}

describe('MaintenanceService', () => {
  it('sweeps every store that accumulates expired rows', async () => {
    const { sessionRepository, passwordResetRepository } = makeRepositories({
      sessions: 3,
      tokens: 2,
    })
    const service = new MaintenanceService(
      sessionRepository,
      passwordResetRepository
    )

    const result = await service.sweepExpired()

    expect(sessionRepository.deleteExpiredSessions).toHaveBeenCalledOnce()
    expect(passwordResetRepository.deleteExpiredTokens).toHaveBeenCalledOnce()
    expect(result).toEqual({ sessions: 3, passwordResetTokens: 2 })
  })

  // The counts are what the caller logs, so a sweep that removed nothing has
  // to be distinguishable from one that removed everything.
  it('reports nothing swept when nothing has expired', async () => {
    const { sessionRepository, passwordResetRepository } = makeRepositories()
    const service = new MaintenanceService(
      sessionRepository,
      passwordResetRepository
    )

    expect(await service.sweepExpired()).toEqual({
      sessions: 0,
      passwordResetTokens: 0,
    })
  })

  // One failing store must not leave the others unswept - and the caller has
  // to hear about it rather than being told the sweep succeeded.
  it('propagates a failure from one store', async () => {
    const { sessionRepository, passwordResetRepository } = makeRepositories()
    vi.mocked(sessionRepository.deleteExpiredSessions).mockRejectedValue(
      new Error('connection reset')
    )
    const service = new MaintenanceService(
      sessionRepository,
      passwordResetRepository
    )

    await expect(service.sweepExpired()).rejects.toThrow('connection reset')
    expect(passwordResetRepository.deleteExpiredTokens).toHaveBeenCalledOnce()
  })
})
