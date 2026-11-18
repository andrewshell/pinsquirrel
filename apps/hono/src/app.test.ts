import { describe, it, expect, vi, beforeEach } from 'vitest'

const login = vi.fn()
const validateResetToken = vi.fn()
const info = vi.fn()

vi.mock('./lib/services', async importOriginal => {
  const real = await importOriginal<typeof import('./lib/services')>()
  return {
    ...real,
    authService: { login: (...a: unknown[]) => login(...a) as unknown },
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
import {
  oauthRegisterLimiter,
  oauthTokenIpLimiter,
} from './middleware/rate-limit'
import { exhaust, TEST_CLIENT_IP } from './test-support/rate-limit'

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

describe('request body limit', () => {
  function post(path: string, body: string, contentType: string) {
    return app.request(path, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.length),
        'Sec-Fetch-Site': 'same-origin',
      },
      body,
    })
  }

  beforeEach(() => {
    login.mockReset()
  })

  it('refuses an oversize form POST with 413 before the handler runs', async () => {
    const body = `username=victim&password=x&pad=${'a'.repeat(1024 * 1024)}`

    const res = await post('/signin', body, 'application/x-www-form-urlencoded')

    expect(res.status).toBe(413)
    expect(login).not.toHaveBeenCalled()
  })

  it('still accepts an ordinary form POST', async () => {
    login.mockRejectedValue(new Error('reached the handler'))

    await post(
      '/signin',
      'username=a&password=b',
      'application/x-www-form-urlencoded'
    )

    expect(login).toHaveBeenCalled()
  })

  it('refuses an oversize JSON POST to a machine endpoint in JSON', async () => {
    const body = JSON.stringify({ pad: 'a'.repeat(1024 * 1024) })

    const res = await post('/oauth/register', body, 'application/json')

    expect(res.status).toBe(413)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('lets an import upload past the form limit through to the import route', async () => {
    const body = `pad=${'a'.repeat(1024 * 1024)}`

    const res = await post('/import', body, 'application/x-www-form-urlencoded')

    expect(res.status).not.toBe(413)
  })

  it('refuses an import upload over the upload limit', async () => {
    const body = `pad=${'a'.repeat(11 * 1024 * 1024)}`

    const res = await post('/import', body, 'application/x-www-form-urlencoded')

    expect(res.status).toBe(413)
  })
})

// The token and registration routes mount at `/oauth`, the same prefix as the
// consent screen, so a limiter they apply to every path would also count the
// pages a signed-in person loads.
describe('OAuth endpoint rate limits', () => {
  const consentForm = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Sec-Fetch-Site': 'same-origin',
    },
    body: 'decision=approve',
  }

  beforeEach(() => {
    oauthRegisterLimiter.reset(TEST_CLIENT_IP)
    oauthTokenIpLimiter.reset(TEST_CLIENT_IP)
  })

  it('serves the consent screen and extension callback once the registration budget is spent', async () => {
    exhaust(oauthRegisterLimiter, TEST_CLIENT_IP)

    const statuses = [
      (await app.request('/oauth/authorize?client_id=x')).status,
      (await app.request('/oauth/authorize', consentForm)).status,
      (await app.request('/oauth/extension/callback?code=x')).status,
    ]

    expect(statuses).not.toContain(429)
  })

  it('serves the consent screen and extension callback once the token budget is spent', async () => {
    exhaust(oauthTokenIpLimiter, TEST_CLIENT_IP)

    const statuses = [
      (await app.request('/oauth/authorize?client_id=x')).status,
      (await app.request('/oauth/authorize', consentForm)).status,
      (await app.request('/oauth/extension/callback?code=x')).status,
    ]

    expect(statuses).not.toContain(429)
  })

  it('leaves the registration and token budgets to their own endpoints', async () => {
    // More page loads than either budget allows an address.
    for (let i = 0; i < 31; i++) {
      await app.request('/oauth/authorize?client_id=x')
      await app.request('/oauth/extension/callback?code=x')
    }

    // A wrong content type is answered after the limiter, so a status other
    // than 429 shows the budget is still there.
    const register = await app.request('/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'x',
    })
    const revoke = await app.request('/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'x',
    })

    expect([register.status, revoke.status]).toEqual([415, 415])
  })
})
