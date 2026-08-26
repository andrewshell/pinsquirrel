import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { User } from '@pinsquirrel/domain'
import type { ProtectedResourceConfig } from '../lib/config'

const mockVerifyAccessToken = vi.fn()

vi.mock('../lib/services', () => ({
  oauthService: {
    verifyAccessToken: (...args: unknown[]) =>
      mockVerifyAccessToken(...args) as unknown,
  },
}))

const { oauthAuth, getOAuthUser, getOAuthPrincipal } =
  await import('./oauth-auth')

const testUser = { id: 'user-1', username: 'alice' } as unknown as User

const mcpResource: ProtectedResourceConfig = {
  resource: 'https://pinsquirrel.test/mcp',
  metadataPath: '/.well-known/oauth-protected-resource/mcp',
  metadataUrl:
    'https://pinsquirrel.test/.well-known/oauth-protected-resource/mcp',
  scopes: ['pins:read', 'tags:read'],
}

const CHALLENGE =
  'Bearer resource_metadata="https://pinsquirrel.test/.well-known/oauth-protected-resource/mcp", scope="pins:read tags:read"'

function appWith(resource: ProtectedResourceConfig): Hono {
  const app = new Hono()
  app.use('*', oauthAuth(resource))
  app.get('/thing', c =>
    c.json({
      user: getOAuthUser(c).id,
      principal: getOAuthPrincipal(c),
    })
  )
  return app
}

describe('oauthAuth', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    app = appWith(mcpResource)
  })

  it('challenges a request with no Authorization header', async () => {
    const res = await app.request('/thing')

    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe(CHALLENGE)
    expect(await res.json()).toEqual({
      error: 'invalid_token',
      error_description: 'An OAuth bearer token is required',
    })
    expect(mockVerifyAccessToken).not.toHaveBeenCalled()
  })

  it('challenges an Authorization header that is not a bearer token', async () => {
    const res = await app.request('/thing', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: 'invalid_token',
      error_description: 'The Authorization header must be a Bearer token',
    })
    expect(mockVerifyAccessToken).not.toHaveBeenCalled()
  })

  // X-API-Key was the API-key-only header and there are no API keys on this
  // path. Authorization: Bearer is the only credential form.
  it('ignores an X-API-Key header entirely', async () => {
    const res = await app.request('/thing', {
      headers: { 'X-API-Key': 'ps_something' },
    })

    expect(res.status).toBe(401)
    expect(mockVerifyAccessToken).not.toHaveBeenCalled()
  })

  it('challenges a token the service does not accept', async () => {
    mockVerifyAccessToken.mockResolvedValue(null)

    const res = await app.request('/thing', {
      headers: { Authorization: 'Bearer pso_bad' },
    })

    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe(CHALLENGE)
    expect(await res.json()).toEqual({
      error: 'invalid_token',
      error_description: 'The access token is invalid, expired, or revoked',
    })
  })

  // Audience binding lives in the service; the middleware's job is to hand it
  // the resource this route is (Decision 18), so neither route can inherit the
  // other's.
  it('verifies against the resource it was constructed with', async () => {
    mockVerifyAccessToken.mockResolvedValue(null)

    await app.request('/thing', {
      headers: { Authorization: 'Bearer pso_token' },
    })

    expect(mockVerifyAccessToken).toHaveBeenCalledWith(
      'pso_token',
      'https://pinsquirrel.test/mcp'
    )
  })

  it('sets the principal on success', async () => {
    mockVerifyAccessToken.mockResolvedValue({
      token: { id: 'token-1' },
      user: testUser,
      clientId: 'client-1',
      scopes: ['pins:read'],
    })

    const res = await app.request('/thing', {
      headers: { Authorization: 'Bearer pso_good' },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      user: 'user-1',
      principal: {
        user: { id: 'user-1', username: 'alice' },
        clientId: 'client-1',
        scopes: ['pins:read'],
        rawToken: 'pso_good',
      },
    })
  })
})
