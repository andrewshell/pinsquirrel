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

const { oauthAuth, requireScope, getOAuthUser, getOAuthPrincipal } =
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

  // `Authorization: Bearer` is the only credential form. A credential offered
  // in any other header is not a credential.
  it('ignores a non-bearer credential header entirely', async () => {
    const res = await app.request('/thing', {
      headers: { 'X-Custom-Credential': 'something' },
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
  // the resource this route is (Decision 16), so neither route can inherit the
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
        // The resource that accepted the token travels with it, so a later
        // requireScope refuses against this resource and not the other one.
        resource: mcpResource,
      },
    })
  })
})

describe('requireScope', () => {
  function guarded(scope: string): Hono {
    const app = new Hono()
    app.use('*', oauthAuth(mcpResource))
    app.post('/write', requireScope(scope), c => c.json({ wrote: true }))
    return app
  }

  function withScopes(scopes: string[]) {
    mockVerifyAccessToken.mockResolvedValue({
      token: { id: 'token-1' },
      user: testUser,
      clientId: 'client-1',
      scopes,
    })
  }

  const post = (app: Hono) =>
    app.request('/write', {
      method: 'POST',
      headers: { Authorization: 'Bearer pso_good' },
    })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lets a token carrying the scope through to the handler', async () => {
    withScopes(['pins:read', 'pins:write'])

    const res = await post(guarded('pins:write'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ wrote: true })
  })

  // 403, not 401: the token is perfectly valid, so re-presenting it will not
  // help. Answering 401 would send a client round the refresh loop for a
  // problem no refresh can fix.
  it('refuses a token that does not carry the scope with a 403', async () => {
    withScopes(['pins:read', 'tags:read'])

    const res = await post(guarded('pins:write'))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'insufficient_scope',
      error_description: 'This request requires the pins:write scope',
    })
  })

  it('names the error and the missing scope in the challenge (RFC 6750 3.1)', async () => {
    withScopes(['pins:read', 'tags:read'])

    const res = await post(guarded('tags:write'))

    expect(res.headers.get('WWW-Authenticate')).toBe(
      'Bearer error="insufficient_scope", ' +
        'resource_metadata="https://pinsquirrel.test/.well-known/oauth-protected-resource/mcp", ' +
        'scope="tags:write"'
    )
  })

  // The reads have to stay reachable on a read-only token, which is the whole
  // reason the check sits on the operation and not on the resource
  // (Decision 20).
  it('leaves a read route alone', async () => {
    withScopes(['pins:read'])
    const app = new Hono()
    app.use('*', oauthAuth(mcpResource))
    app.get('/read', c => c.json({ read: true }))

    const res = await app.request('/read', {
      headers: { Authorization: 'Bearer pso_good' },
    })

    expect(res.status).toBe(200)
  })

  // The point of the guard: a grant issued before these scopes existed
  // carries neither, and no amount of it being otherwise valid changes that.
  it('refuses a token minted before the write scopes existed', async () => {
    withScopes(['pins:read', 'tags:read', 'offline_access'])

    expect((await post(guarded('pins:write'))).status).toBe(403)
    expect((await post(guarded('tags:write'))).status).toBe(403)
  })

  it('does not confuse one write scope for the other', async () => {
    withScopes(['pins:write'])

    expect((await post(guarded('tags:write'))).status).toBe(403)
    expect((await post(guarded('pins:write'))).status).toBe(200)
  })
})
