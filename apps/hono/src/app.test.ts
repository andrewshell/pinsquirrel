import { describe, it, expect, vi, beforeEach } from 'vitest'

const validateResetToken = vi.fn()
const info = vi.fn()

vi.mock('./lib/services', async importOriginal => {
  const real = await importOriginal<typeof import('./lib/services')>()
  return {
    ...real,
    accountService: {
      ...real.accountService,
      validateResetToken: (...a: unknown[]) =>
        validateResetToken(...a) as unknown,
    },
  }
})

vi.mock('./lib/logger.js', () => ({
  logger: {
    info: (...a: unknown[]) => info(...a) as unknown,
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  safeError: (e: unknown) => ({ message: String(e) }),
}))

import { app } from './app'

describe('request log', () => {
  beforeEach(() => {
    validateResetToken.mockReset()
    info.mockReset()
  })

  it('names the reset page without the token from its path', async () => {
    validateResetToken.mockResolvedValue(true)

    const res = await app.request('/reset-password/secret-token-123')
    expect(res.status).toBe(200)

    const logged = JSON.stringify(info.mock.calls)
    expect(logged).toContain('request')
    expect(logged).toContain('/reset-password/')
    expect(logged).not.toContain('secret-token-123')
  })
})
