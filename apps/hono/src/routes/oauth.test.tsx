/**
 * Route tests for the consent screen.
 *
 * The session middleware here is the real one over fake repositories, so the
 * sign-in redirect and its return path are exercised rather than mocked away:
 * an unauthenticated visitor has to come back to the *full* authorize URL, and
 * a fake `requireAuth` would prove nothing about that.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { OAuthClient, User } from '@pinsquirrel/domain'
import {
  OAuthInvalidRequestError,
  OAuthInvalidScopeError,
  ValidationError,
} from '@pinsquirrel/domain'

const mockResolveAuthorizationRequest = vi.fn()
const mockAuthorize = vi.fn()
const mockIsValidSession = vi.fn()
const mockFindSession = vi.fn()
const mockFindUser = vi.fn()

vi.mock('../lib/services', () => ({
  oauthService: {
    resolveAuthorizationRequest: (...a: unknown[]) =>
      mockResolveAuthorizationRequest(...a) as unknown,
    authorize: (...a: unknown[]) => mockAuthorize(...a) as unknown,
  },
}))

vi.mock('../lib/db', () => ({
  sessionRepository: {
    isValidSession: (...a: unknown[]) => mockIsValidSession(...a) as unknown,
    findById: (...a: unknown[]) => mockFindSession(...a) as unknown,
    update: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  },
  userRepository: {
    findById: (...a: unknown[]) => mockFindUser(...a) as unknown,
  },
}))

const { sessionMiddleware } = await import('../middleware/session')
const { oauthRoutes } = await import('./oauth')

const testUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
} as unknown as User

const testClient = {
  id: 'row-1',
  clientId: 'https://claude.ai/oauth/claude-code-client-metadata',
  clientName: 'Claude Code',
  redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
  grantTypes: ['authorization_code', 'refresh_token'],
  tokenEndpointAuthMethod: 'none',
  registrationType: 'cimd',
} as unknown as OAuthClient

const REQUEST_PARAMS = {
  response_type: 'code',
  client_id: 'https://claude.ai/oauth/claude-code-client-metadata',
  redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
  code_challenge: 'c'.repeat(43),
  code_challenge_method: 'S256',
  scope: 'pins:read tags:read offline_access',
  state: 'the-state',
  resource: 'http://localhost:8100/mcp',
}

const RESOLVED = {
  client: testClient,
  redirectUri: 'https://claude.ai/api/mcp/auth_callback',
  registeredRedirectUri: 'https://claude.ai/api/mcp/auth_callback',
  scopes: ['pins:read', 'tags:read', 'offline_access'],
  resource: 'http://localhost:8100/mcp',
  codeChallenge: 'c'.repeat(43),
  state: 'the-state',
}

const AUTHORIZE_URL = `/oauth/authorize?${new URLSearchParams(REQUEST_PARAMS).toString()}`

function signedIn() {
  mockIsValidSession.mockResolvedValue(true)
  mockFindSession.mockResolvedValue({
    id: 'session-1',
    userId: 'user-1',
    data: { userId: 'user-1', keepSignedIn: true },
  })
  mockFindUser.mockResolvedValue(testUser)
}

describe('oauth authorize routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    app = new Hono()
    app.use('*', sessionMiddleware())
    app.route('/oauth', oauthRoutes)
  })

  function get(url = AUTHORIZE_URL) {
    return app.request(url, { headers: { Cookie: '__session=session-1' } })
  }

  function post(fields: Record<string, string>) {
    return app.request('/oauth/authorize', {
      method: 'POST',
      headers: {
        Cookie: '__session=session-1',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(fields).toString(),
    })
  }

  describe('when nobody is signed in', () => {
    // The whole authorize URL has to survive the round trip: drop the query
    // and the user comes back to a request with no client, no PKCE challenge
    // and no audience.
    it('sends the visitor to sign in and back to the full authorize URL', async () => {
      const res = await app.request(AUTHORIZE_URL)

      expect(res.status).toBe(302)
      const location = res.headers.get('Location') ?? ''
      expect(location.startsWith('/signin?redirectTo=')).toBe(true)
      expect(decodeURIComponent(location.split('redirectTo=')[1])).toBe(
        AUTHORIZE_URL
      )
      expect(mockResolveAuthorizationRequest).not.toHaveBeenCalled()
    })
  })

  describe('GET /oauth/authorize', () => {
    beforeEach(signedIn)

    it('renders the consent screen with the client name and the redirect host', async () => {
      mockResolveAuthorizationRequest.mockResolvedValue(RESOLVED)

      const res = await get()
      const html = await res.text()

      expect(res.status).toBe(200)
      expect(html).toContain('Claude Code')
      expect(html).toContain('claude.ai')
      expect(mockResolveAuthorizationRequest).toHaveBeenCalledWith(
        REQUEST_PARAMS
      )
    })

    it('names the requested scopes', async () => {
      mockResolveAuthorizationRequest.mockResolvedValue(RESOLVED)

      const html = await (await get()).text()

      expect(html).toContain('pins:read')
      expect(html).toContain('tags:read')
      expect(html).toContain('offline_access')
    })

    // An undescribed scope is one a user approves without being told what it
    // does, and a write scope is exactly the one they need told about.
    it('says what the write scopes let the client do, in the user own words', async () => {
      mockResolveAuthorizationRequest.mockResolvedValue({
        ...RESOLVED,
        scopes: ['pins:write', 'tags:write'],
      })

      const html = await (await get()).text()

      expect(html).toContain('Add, edit and delete your bookmarks')
      expect(html).toContain('Merge and delete your tags')
    })

    // A client that supplied no name still has to be identifiable, or the
    // consent screen is the only defense against loopback impersonation and
    // it says nothing.
    it('falls back to the client id when the client has no name', async () => {
      mockResolveAuthorizationRequest.mockResolvedValue({
        ...RESOLVED,
        client: { ...testClient, clientName: null },
      })

      const html = await (await get()).text()

      expect(html).toContain(
        'https://claude.ai/oauth/claude-code-client-metadata'
      )
    })

    it('offers approve and deny as a plain form posting back here', async () => {
      mockResolveAuthorizationRequest.mockResolvedValue(RESOLVED)

      const html = await (await get()).text()

      expect(html).toContain('action="/oauth/authorize"')
      expect(html).toContain('method="post"')
      expect(html).toContain('value="approve"')
      expect(html).toContain('value="deny"')
    })

    // The app ships script-src 'self', so an inline handler would not run.
    it('ships no inline script', async () => {
      mockResolveAuthorizationRequest.mockResolvedValue(RESOLVED)

      const html = await (await get()).text()

      expect(/<script(?![^>]*\ssrc=)/.test(html)).toBe(false)
    })

    // Nothing has established that the redirect URI belongs to this client
    // yet, so there is nowhere trustworthy to send an error.
    it('renders a request error instead of redirecting', async () => {
      mockResolveAuthorizationRequest.mockRejectedValue(
        new OAuthInvalidRequestError(
          'redirect_uri does not match a URI this client registered'
        )
      )

      const res = await get()

      expect(res.status).toBe(400)
      expect(res.headers.get('Location')).toBeNull()
      expect(await res.text()).toContain(
        'redirect_uri does not match a URI this client registered'
      )
    })

    it('renders a validation failure the same way', async () => {
      mockResolveAuthorizationRequest.mockRejectedValue(
        new ValidationError({
          code_challenge_method: ['must be S256'],
        })
      )

      const res = await get()

      expect(res.status).toBe(400)
      expect(await res.text()).toContain('code_challenge_method')
    })
  })

  describe('POST /oauth/authorize', () => {
    beforeEach(signedIn)

    it('redirects with code, state and iss on approval', async () => {
      mockAuthorize.mockResolvedValue({
        status: 'approved',
        code: 'the-code',
        redirectUri: 'https://claude.ai/api/mcp/auth_callback',
        state: 'the-state',
        scopes: ['pins:read'],
        expiresAt: new Date(),
        issuer: 'http://localhost:8100',
      })

      const res = await post({ ...REQUEST_PARAMS, decision: 'approve' })

      expect(res.status).toBe(302)
      const location = new URL(res.headers.get('Location') ?? '')
      expect(location.origin + location.pathname).toBe(
        'https://claude.ai/api/mcp/auth_callback'
      )
      expect(location.searchParams.get('code')).toBe('the-code')
      expect(location.searchParams.get('state')).toBe('the-state')
      expect(location.searchParams.get('iss')).toBe('http://localhost:8100')
    })

    it('hands the decision and the signed-in user to the service', async () => {
      mockAuthorize.mockResolvedValue({
        status: 'approved',
        code: 'the-code',
        redirectUri: 'https://claude.ai/api/mcp/auth_callback',
        scopes: ['pins:read'],
        expiresAt: new Date(),
        issuer: 'http://localhost:8100',
      })

      await post({ ...REQUEST_PARAMS, decision: 'approve' })

      expect(mockAuthorize).toHaveBeenCalledWith(expect.anything(), {
        params: REQUEST_PARAMS,
        userId: 'user-1',
        approved: true,
      })
    })

    // A denial still has to reach the client, and by then the redirect URI is
    // one the client registered.
    it('redirects with access_denied and iss on denial', async () => {
      mockAuthorize.mockResolvedValue({
        status: 'denied',
        error: 'access_denied',
        errorDescription: 'The user denied the authorization request',
        redirectUri: 'https://claude.ai/api/mcp/auth_callback',
        state: 'the-state',
        issuer: 'http://localhost:8100',
      })

      const res = await post({ ...REQUEST_PARAMS, decision: 'deny' })

      expect(res.status).toBe(302)
      const location = new URL(res.headers.get('Location') ?? '')
      expect(location.searchParams.get('error')).toBe('access_denied')
      expect(location.searchParams.get('error_description')).toBe(
        'The user denied the authorization request'
      )
      expect(location.searchParams.get('state')).toBe('the-state')
      expect(location.searchParams.get('iss')).toBe('http://localhost:8100')
      expect(location.searchParams.get('code')).toBeNull()
    })

    it('treats anything that is not approve as a denial', async () => {
      mockAuthorize.mockResolvedValue({
        status: 'denied',
        error: 'access_denied',
        errorDescription: 'The user denied the authorization request',
        redirectUri: 'https://claude.ai/api/mcp/auth_callback',
        issuer: 'http://localhost:8100',
      })

      await post({ ...REQUEST_PARAMS })

      expect(mockAuthorize).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ approved: false })
      )
    })

    it('leaves state out when the client sent none', async () => {
      mockAuthorize.mockResolvedValue({
        status: 'approved',
        code: 'the-code',
        redirectUri: 'https://claude.ai/api/mcp/auth_callback',
        scopes: ['pins:read'],
        expiresAt: new Date(),
        issuer: 'http://localhost:8100',
      })

      const withoutState: Record<string, string> = { ...REQUEST_PARAMS }
      delete withoutState.state
      const res = await post({ ...withoutState, decision: 'approve' })

      const location = new URL(res.headers.get('Location') ?? '')
      expect(location.searchParams.has('state')).toBe(false)
    })

    it('renders a request error instead of redirecting', async () => {
      mockAuthorize.mockRejectedValue(
        new OAuthInvalidScopeError('Unknown scope: pins:write')
      )

      const res = await post({ ...REQUEST_PARAMS, decision: 'approve' })

      expect(res.status).toBe(400)
      expect(res.headers.get('Location')).toBeNull()
      expect(await res.text()).toContain('Unknown scope: pins:write')
    })
  })
})
