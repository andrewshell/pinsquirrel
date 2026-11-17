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
