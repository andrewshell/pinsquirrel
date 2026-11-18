import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import {
  OAuthInvalidClientError,
  OAuthInvalidGrantError,
  OAuthInvalidTargetError,
  OAuthTemporarilyUnavailableError,
  OAuthUnauthorizedClientError,
  ValidationError,
  WriteConflictError,
} from '@pinsquirrel/domain'

const mockExchangeAuthorizationCode = vi.fn()
const mockExchangeRefreshToken = vi.fn()
const mockRevokeToken = vi.fn()
const mockLogWarn = vi.hoisted(() => vi.fn())

vi.mock('../lib/logger.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/logger.js')>()),
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: mockLogWarn },
}))

vi.mock('../lib/services', () => ({
  oauthService: {
    exchangeAuthorizationCode: (...a: unknown[]) =>
      mockExchangeAuthorizationCode(...a) as unknown,
    exchangeRefreshToken: (...a: unknown[]) =>
      mockExchangeRefreshToken(...a) as unknown,
    revokeToken: (...a: unknown[]) => mockRevokeToken(...a) as unknown,
  },
}))

import { oauthTokenIpLimiter } from '../middleware/rate-limit'
import { TEST_CLIENT_IP, exhaust } from '../test-support/rate-limit'

const { oauthTokenRoutes } = await import('./oauth-token')

const ISSUED = {
  accessToken: 'pso_access',
  refreshToken: 'pso_refresh',
  tokenType: 'Bearer' as const,
  expiresIn: 3600,
  scopes: ['pins:read', 'tags:read'],
  resource: 'http://localhost:8100/mcp',
}

function form(fields: Record<string, string>) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  }
}

const CODE_GRANT = {
  grant_type: 'authorization_code',
  code: 'the-code',
  redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
  client_id: 'https://claude.ai/oauth/client',
  code_verifier: 'v'.repeat(64),
}

describe('POST /oauth/token', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    // Module-level limiters outlive a single test, so every case starts with
    // its own budget rather than inheriting whatever the last one spent.
    oauthTokenIpLimiter.reset(TEST_CLIENT_IP)
    app = new Hono()
    app.route('/oauth', oauthTokenRoutes)
  })

  // Claude sends the initial exchange and every refresh as a form. A
  // JSON-only handler would answer 415 and the whole flow dies, so the shape
  // this endpoint accepts is asserted rather than assumed.
  it('rejects a JSON body with 415', async () => {
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CODE_GRANT),
    })

    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({
      error: 'invalid_request',
      error_description:
        'The token endpoint accepts application/x-www-form-urlencoded only',
    })
    expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled()
  })

  it('accepts a form content type carrying a charset', async () => {
    mockExchangeAuthorizationCode.mockResolvedValue(ISSUED)

    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams(CODE_GRANT).toString(),
    })

    expect(res.status).toBe(200)
  })

  it('exchanges an authorization code and answers in the RFC 6749 shape', async () => {
    mockExchangeAuthorizationCode.mockResolvedValue(ISSUED)

    const res = await app.request('/oauth/token', form(CODE_GRANT))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      access_token: 'pso_access',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'pso_refresh',
      scope: 'pins:read tags:read',
    })
    expect(mockExchangeAuthorizationCode).toHaveBeenCalledWith(CODE_GRANT)
  })

  // Access tokens must never be cached by an intermediary (RFC 6749 5.1).
  it('marks the response no-store', async () => {
    mockExchangeAuthorizationCode.mockResolvedValue(ISSUED)

    const res = await app.request('/oauth/token', form(CODE_GRANT))

    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('omits refresh_token when the grant did not include one', async () => {
    mockExchangeAuthorizationCode.mockResolvedValue({
      ...ISSUED,
      refreshToken: null,
    })

    const res = await app.request('/oauth/token', form(CODE_GRANT))

    expect(await res.json()).toEqual({
      access_token: 'pso_access',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'pins:read tags:read',
    })
  })

  it('exchanges a refresh token', async () => {
    mockExchangeRefreshToken.mockResolvedValue(ISSUED)

    const res = await app.request(
      '/oauth/token',
      form({
        grant_type: 'refresh_token',
        refresh_token: 'pso_old',
        client_id: 'client-1',
      })
    )

    expect(res.status).toBe(200)
    expect(mockExchangeRefreshToken).toHaveBeenCalledWith({
      grant_type: 'refresh_token',
      refresh_token: 'pso_old',
      client_id: 'client-1',
    })
    expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled()
  })

  it('answers an unknown grant type with unsupported_grant_type', async () => {
    const res = await app.request(
      '/oauth/token',
      form({ grant_type: 'client_credentials', client_id: 'client-1' })
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'unsupported_grant_type',
      error_description: 'client_credentials is not a supported grant type',
    })
  })

  it('answers a missing grant type the same way', async () => {
    const res = await app.request('/oauth/token', form({ client_id: 'c' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('unsupported_grant_type')
  })

  // RFC 6749 3.2: a parameter MUST NOT be included more than once.
  it('hands a repeated parameter to the service as every value sent', async () => {
    mockExchangeAuthorizationCode.mockResolvedValue(ISSUED)
    const body = new URLSearchParams(CODE_GRANT)
    body.append('code', 'another-code')

    await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    expect(mockExchangeAuthorizationCode).toHaveBeenCalledWith({
      ...CODE_GRANT,
      code: ['the-code', 'another-code'],
    })
  })

  it('answers a repeated grant type with invalid_request', async () => {
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code&grant_type=refresh_token',
    })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_request')
    expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled()
  })

  it('maps a ValidationError to invalid_request', async () => {
    mockExchangeAuthorizationCode.mockRejectedValue(
      new ValidationError({ code_verifier: ['must be a PKCE value'] })
    )

    const res = await app.request('/oauth/token', form(CODE_GRANT))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'invalid_request',
      error_description: 'code_verifier: must be a PKCE value',
    })
  })

  // Claude re-runs consent on invalid_grant and gives up on anything it does
  // not recognise, so a dead refresh token has to carry exactly this code.
  it('maps a dead grant to invalid_grant', async () => {
    mockExchangeRefreshToken.mockRejectedValue(
      new OAuthInvalidGrantError('The refresh token has been revoked')
    )

    const res = await app.request(
      '/oauth/token',
      form({
        grant_type: 'refresh_token',
        refresh_token: 'pso_dead',
        client_id: 'client-1',
      })
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'invalid_grant',
      error_description: 'The refresh token has been revoked',
    })
  })

  it('answers invalid_client with 401, not 400', async () => {
    mockExchangeAuthorizationCode.mockRejectedValue(
      new OAuthInvalidClientError('Unknown client')
    )

    const res = await app.request('/oauth/token', form(CODE_GRANT))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: 'invalid_client',
      error_description: 'Unknown client',
    })
  })

  it.each([
    [new OAuthUnauthorizedClientError('nope'), 'unauthorized_client'],
    [new OAuthInvalidTargetError('nope'), 'invalid_target'],
  ])('passes %s through as its own code', async (error, code) => {
    mockExchangeAuthorizationCode.mockRejectedValue(error)

    const res = await app.request('/oauth/token', form(CODE_GRANT))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(code)
  })

  it('answers a request the server could not finish with 503 and Retry-After', async () => {
    mockExchangeRefreshToken.mockRejectedValue(
      new OAuthTemporarilyUnavailableError()
    )

    const res = await app.request(
      '/oauth/token',
      form({
        grant_type: 'refresh_token',
        refresh_token: 'still-valid',
        client_id: 'https://claude.ai/oauth/client',
      })
    )

    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('1')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({
      error: 'temporarily_unavailable',
      error_description: 'The server is busy. Send the request again',
    })
  })

  it('logs what a request the server could not finish lost to', async () => {
    mockExchangeRefreshToken.mockRejectedValue(
      new OAuthTemporarilyUnavailableError(undefined, {
        cause: new WriteConflictError(
          'The write waited too long for a lock and changed nothing'
        ),
      })
    )

    await app.request(
      '/oauth/token',
      form({
        grant_type: 'refresh_token',
        refresh_token: 'still-valid',
        client_id: 'https://claude.ai/oauth/client',
      })
    )

    expect(mockLogWarn).toHaveBeenCalledWith(
      {
        error: 'temporarily_unavailable',
        cause: expect.objectContaining({
          message: 'The write waited too long for a lock and changed nothing',
        }) as unknown,
      },
      'The server is busy. Send the request again'
    )
  })

  it('marks an error response no-store too', async () => {
    mockExchangeAuthorizationCode.mockRejectedValue(
      new OAuthInvalidGrantError()
    )

    const res = await app.request('/oauth/token', form(CODE_GRANT))

    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  describe('rate limiting', () => {
    it('answers 429 with Retry-After once the per-IP quota is spent', async () => {
      exhaust(oauthTokenIpLimiter, TEST_CLIENT_IP)

      const res = await app.request('/oauth/token', form(CODE_GRANT))

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeTruthy()
      expect(mockExchangeAuthorizationCode).not.toHaveBeenCalled()
    })

    it('serves a valid exchange after other addresses send invalid ones for the same client', async () => {
      mockExchangeAuthorizationCode.mockImplementation(
        (input: { code: string }) =>
          input.code === CODE_GRANT.code
            ? Promise.resolve(ISSUED)
            : Promise.reject(new OAuthInvalidGrantError())
      )
      const others = Array.from({ length: 6 }, (_, i) => `203.0.113.${i + 1}`)

      const refused: number[] = []
      for (let i = 0; i < 300; i++) {
        const res = await app.request(
          '/oauth/token',
          form({ ...CODE_GRANT, code: `wrong-${i}` }),
          { incoming: { socket: { remoteAddress: others[i % others.length] } } }
        )
        refused.push(res.status)
      }
      const res = await app.request('/oauth/token', form(CODE_GRANT))

      expect(new Set(refused)).toEqual(new Set([400]))
      expect(res.status).toBe(200)
    })
  })
})

describe('POST /oauth/revoke', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    // Module-level limiters outlive a single test, so every case starts with
    // its own budget rather than inheriting whatever the last one spent.
    oauthTokenIpLimiter.reset(TEST_CLIENT_IP)
    app = new Hono()
    app.route('/oauth', oauthTokenRoutes)
  })

  it('rejects a JSON body with 415', async () => {
    const res = await app.request('/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'pso_x' }),
    })

    expect(res.status).toBe(415)
    expect(mockRevokeToken).not.toHaveBeenCalled()
  })

  // RFC 7009 2.2.1: on a 503 the client assumes the token still exists and
  // sends the revocation again.
  it('answers a revocation the server could not finish with 503 and Retry-After, and logs what it lost to', async () => {
    mockRevokeToken.mockRejectedValue(
      new OAuthTemporarilyUnavailableError(undefined, {
        cause: new Error('Deadlock found'),
      })
    )

    const res = await app.request(
      '/oauth/revoke',
      form({ token: 'pso_refresh' })
    )

    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('1')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({
      error: 'temporarily_unavailable',
      error_description: 'The server is busy. Send the request again',
    })
    expect(mockLogWarn).toHaveBeenCalledOnce()
  })

  it('hands the token to the service and answers 200 with no body', async () => {
    mockRevokeToken.mockResolvedValue(undefined)

    const res = await app.request(
      '/oauth/revoke',
      form({
        token: 'pso_x',
        client_id: 'client-1',
        token_type_hint: 'refresh_token',
      })
    )

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
    expect(mockRevokeToken).toHaveBeenCalledWith({
      token: 'pso_x',
      client_id: 'client-1',
      token_type_hint: 'refresh_token',
    })
  })

  // RFC 7009: an unknown token is a successful revocation. Reporting which
  // was which would be a way to find out whether a token exists.
  it('answers 200 for an unknown token', async () => {
    mockRevokeToken.mockResolvedValue(undefined)

    const res = await app.request('/oauth/revoke', form({ token: 'nope' }))

    expect(res.status).toBe(200)
  })

  it('answers 400 invalid_request when the service finds the request malformed', async () => {
    mockRevokeToken.mockRejectedValue(
      new ValidationError({ token: ['Required'] })
    )

    const res = await app.request('/oauth/revoke', form({ client_id: 'c' }))

    expect(res.status).toBe(400)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({
      error: 'invalid_request',
      error_description: 'token: Required',
    })
  })

  it('answers 400 with the code the service refuses a token with', async () => {
    mockRevokeToken.mockRejectedValue(
      new OAuthInvalidGrantError('The token was issued to another client')
    )

    const res = await app.request(
      '/oauth/revoke',
      form({ token: 'pso_x', client_id: 'other' })
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'invalid_grant',
      error_description: 'The token was issued to another client',
    })
  })
})
