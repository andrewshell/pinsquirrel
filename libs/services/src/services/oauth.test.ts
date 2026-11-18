import { createHash } from 'node:crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Deterministic secrets, so a test can assert what was stored against what
// was handed back. The real generator and hash are covered by their own unit
// tests; what matters here is that the raw value never reaches a repository.
vi.mock('../utils/crypto.js', () => {
  let issued = 0
  return {
    generateSecureToken: vi.fn(() => `secret-${String(++issued)}`),
    hashToken: vi.fn((value: string) => `hashed_${value}`),
  }
})
import type {
  AuthorizationCode,
  CreateOAuthTokenData,
  HttpFetcher,
  OAuthToken,
  User,
  OAuthClient,
  OAuthClientRepository,
  UserRepository,
} from '@pinsquirrel/domain'
import {
  AccessControl,
  OAuthAccessDeniedError,
  OAuthInvalidClientError,
  OAuthInvalidClientMetadataError,
  OAuthInvalidGrantError,
  OAuthInvalidRequestError,
  OAuthInvalidScopeError,
  OAuthInvalidTargetError,
  OAuthUnauthorizedClientError,
  ResponseTooLargeError,
  Role,
  UserStatus,
  ValidationError,
} from '@pinsquirrel/domain'
import {
  createInMemoryOAuthStore,
  createMockUserRepository,
} from '../test-utils.js'
import { OAuthService, REFRESH_ROTATION_GRACE_MS } from './oauth.js'

const MCP_RESOURCE = 'https://pinsquirrel.com/mcp'
const API_RESOURCE = 'https://pinsquirrel.com/api/v1'

const CIMD_URL = 'https://claude.ai/oauth/claude-code-client-metadata'

const SESSION_ID = 'session-1'

/** Claude Code's real published document. */
const cimdDocument = {
  client_id: CIMD_URL,
  client_name: 'Claude Code',
  redirect_uris: ['http://localhost/callback', 'http://127.0.0.1/callback'],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
}

/** The PKCE challenge for `CODE_VERIFIER`, from RFC 7636 appendix B. */
const CODE_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const CODE_CHALLENGE = createHash('sha256')
  .update(CODE_VERIFIER)
  .digest('base64url')

function authorizeParams(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    response_type: 'code',
    client_id: CIMD_URL,
    redirect_uri: 'http://localhost:54321/callback',
    code_challenge: CODE_CHALLENGE,
    code_challenge_method: 'S256',
    state: 'opaque-state',
    resource: MCP_RESOURCE,
    ...overrides,
  }
}

function makeUser(id: string, username: string): User {
  return {
    id,
    username,
    passwordHash: 'hashed',
    emailHash: null,
    emailEncrypted: null,
    roles: [Role.User],
    status: UserStatus.Active,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const user = makeUser('user-1', 'squirrel')
const otherUser = makeUser('user-2', 'intruder')

const notAdmitted: [string, User][] = [
  ['without the User role', { ...user, roles: [] }],
  ['on the waitlist', { ...user, status: UserStatus.Waitlist }],
]

function makeClient(overrides: Partial<OAuthClient> = {}): OAuthClient {
  return {
    id: 'client-row-1',
    clientId: CIMD_URL,
    clientName: 'Claude Code',
    redirectUris: ['http://localhost/callback', 'http://127.0.0.1/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    tokenEndpointAuthMethod: 'none',
    registrationType: 'cimd',
    metadataUrl: CIMD_URL,
    metadataFetchedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeCode(
  overrides: Partial<AuthorizationCode> = {}
): AuthorizationCode {
  return {
    id: 'code-1',
    codeHash: 'hashed_raw-code',
    clientId: CIMD_URL,
    userId: user.id,
    redirectUri: 'http://localhost:54321/callback',
    codeChallenge: CODE_CHALLENGE,
    scopes: ['pins:read', 'tags:read'],
    resource: MCP_RESOURCE,
    grantId: 'grant-1',
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeToken(
  data: Omit<CreateOAuthTokenData, 'grantId'>,
  overrides: Partial<OAuthToken> = {}
): OAuthToken {
  return {
    id: `token-${data.kind}`,
    grantId: 'grant-1',
    revokedAt: null,
    rotatedAt: null,
    rotatedFrom: data.rotatedFrom ?? null,
    createdAt: new Date(),
    ...data,
    ...overrides,
  }
}

type Store = ReturnType<typeof createInMemoryOAuthStore>

function seedDevice(
  store: Store,
  device: string,
  overrides: Partial<OAuthToken> = {}
): void {
  for (const kind of ['access', 'refresh'] as const) {
    store.tokens.push(
      makeToken(
        {
          tokenHash: `hashed_${device}-${kind}`,
          kind,
          clientId: CIMD_URL,
          userId: user.id,
          scopes: ['pins:read', 'tags:read', 'offline_access'],
          resource: MCP_RESOURCE,
          expiresAt: new Date(Date.now() + 60_000),
        },
        { id: `${device}-${kind}`, grantId: `grant-${device}`, ...overrides }
      )
    )
  }
}

const liveTokenIds = (store: Store): string[] =>
  store.tokens.filter(token => !token.revokedAt).map(token => token.id)

function setup() {
  const clientRepository = {
    findById: vi.fn(),
    findByClientId: vi.fn().mockResolvedValue(null),
    create: vi.fn(data => Promise.resolve(makeClient(data as OAuthClient))),
    update: vi.fn(),
    delete: vi.fn(),
    markCompleted: vi.fn(),
    deleteExpiredIncompleteClients: vi.fn(),
  } as unknown as OAuthClientRepository

  const store = createInMemoryOAuthStore()
  const { codeRepository, tokenRepository } = store

  const userRepository: UserRepository = createMockUserRepository()
  vi.mocked(userRepository.findById).mockResolvedValue(user)

  const fetcher = {
    fetch: vi.fn().mockResolvedValue(JSON.stringify(cimdDocument)),
  } as unknown as HttpFetcher

  const service = new OAuthService(
    clientRepository,
    codeRepository,
    tokenRepository,
    userRepository,
    fetcher,
    {
      issuer: 'https://pinsquirrel.com',
      resources: [MCP_RESOURCE, API_RESOURCE],
    }
  )

  return {
    service,
    store,
    clientRepository,
    codeRepository,
    tokenRepository,
    userRepository,
    fetcher,
  }
}

describe('OAuthService.resolveClient', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
  })

  it('looks a registered client up by the identifier it sends', async () => {
    const registered = makeClient({
      clientId: 'dcr_abc',
      registrationType: 'dcr',
      metadataUrl: null,
      metadataFetchedAt: null,
    })
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(registered)

    await expect(ctx.service.resolveClient('dcr_abc')).resolves.toBe(registered)
    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })

  it('refuses an identifier nothing is registered under', async () => {
    await expect(ctx.service.resolveClient('dcr_nope')).rejects.toBeInstanceOf(
      OAuthInvalidClientError
    )
  })

  it('fetches, validates and stores a CIMD document the first time', async () => {
    const client = await ctx.service.resolveClient(CIMD_URL)

    expect(ctx.fetcher.fetch).toHaveBeenCalledWith(CIMD_URL, {
      // A metadata URL that redirects is a misconfigured client.
      redirect: 'error',
      maxBytes: 16 * 1024,
    })
    expect(ctx.clientRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CIMD_URL,
        clientName: 'Claude Code',
        redirectUris: cimdDocument.redirect_uris,
        registrationType: 'cimd',
        metadataUrl: CIMD_URL,
        metadataFetchedAt: expect.any(Date) as Date,
      })
    )
    expect(client.clientId).toBe(CIMD_URL)
  })

  it('serves a freshly fetched document from the cached row', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({ metadataFetchedAt: new Date() })
    )

    await ctx.service.resolveClient(CIMD_URL)

    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })

  it('re-fetches a document whose cache entry has gone stale', async () => {
    const stale = makeClient({
      metadataFetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    })
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(stale)
    vi.mocked(ctx.clientRepository.update).mockResolvedValue(stale)

    await ctx.service.resolveClient(CIMD_URL)

    expect(ctx.fetcher.fetch).toHaveBeenCalledOnce()
    expect(ctx.clientRepository.update).toHaveBeenCalledWith(
      stale.id,
      expect.objectContaining({ metadataFetchedAt: expect.any(Date) as Date })
    )
  })

  it('never refreshes a row stored under a different client id', async () => {
    const requested = 'https://claude.example/C.json'
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({
        clientId: 'https://claude.example/c.json',
        metadataFetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      })
    )
    vi.mocked(ctx.fetcher.fetch).mockResolvedValue(
      JSON.stringify({ ...cimdDocument, client_id: requested })
    )

    const client = await ctx.service.resolveClient(requested)

    expect(ctx.clientRepository.update).not.toHaveBeenCalled()
    expect(ctx.clientRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: requested })
    )
    expect(client.clientId).toBe(requested)
  })

  it('never serves a fresh row stored under a different client id', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({ clientId: 'DCR_ABC', registrationType: 'dcr' })
    )

    await expect(ctx.service.resolveClient('dcr_abc')).rejects.toBeInstanceOf(
      OAuthInvalidClientError
    )
  })

  it.each([
    ['an upper-case host', 'https://CLAUDE.example/c.json'],
    ['a host that is not ASCII', 'https://clàude.example/c.json'],
    ['a fragment', 'https://claude.example/c.json#x'],
    ['an empty fragment', 'https://claude.example/c.json#'],
    ['userinfo', 'https://user@claude.example/c.json'],
    ['a default port', 'https://claude.example:443/c.json'],
  ])('refuses a CIMD URL with %s', async (_, clientId) => {
    await expect(ctx.service.resolveClient(clientId)).rejects.toBeInstanceOf(
      OAuthInvalidClientError
    )
    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })

  // The URL rules, all of them before anything is fetched.
  it('refuses a CIMD URL that is not https', async () => {
    await expect(
      ctx.service.resolveClient('http://claude.ai/oauth/metadata')
    ).rejects.toBeInstanceOf(OAuthInvalidClientError)
    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })

  it('refuses a CIMD URL with no path, which names an origin and not a document', async () => {
    await expect(
      ctx.service.resolveClient('https://claude.ai')
    ).rejects.toBeInstanceOf(OAuthInvalidClientError)
    await expect(
      ctx.service.resolveClient('https://claude.ai/')
    ).rejects.toBeInstanceOf(OAuthInvalidClientError)
    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })

  it('refuses a CIMD URL pointing at this network', async () => {
    await expect(
      ctx.service.resolveClient('https://127.0.0.1/metadata')
    ).rejects.toBeInstanceOf(OAuthInvalidClientError)
    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })

  it('refuses a document larger than a client metadata document ever is', async () => {
    vi.mocked(ctx.fetcher.fetch).mockRejectedValue(
      new ResponseTooLargeError(CIMD_URL, 16 * 1024)
    )

    await expect(ctx.service.resolveClient(CIMD_URL)).rejects.toBeInstanceOf(
      OAuthInvalidClientMetadataError
    )
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('refuses a document that is not JSON', async () => {
    vi.mocked(ctx.fetcher.fetch).mockResolvedValue('<html>nope</html>')

    await expect(ctx.service.resolveClient(CIMD_URL)).rejects.toBeInstanceOf(
      OAuthInvalidClientMetadataError
    )
  })

  // The one check CIMD rests on: the document has to claim the URL it was
  // found at, or any client could point at anyone else's metadata.
  it('refuses a document whose client_id is not the URL it came from', async () => {
    vi.mocked(ctx.fetcher.fetch).mockResolvedValue(
      JSON.stringify({
        ...cimdDocument,
        client_id: 'https://evil.example/meta',
      })
    )

    await expect(ctx.service.resolveClient(CIMD_URL)).rejects.toBeInstanceOf(
      OAuthInvalidClientMetadataError
    )
  })

  it('refuses a document with unusable redirect URIs', async () => {
    vi.mocked(ctx.fetcher.fetch).mockResolvedValue(
      JSON.stringify({ ...cimdDocument, redirect_uris: [] })
    )
    await expect(ctx.service.resolveClient(CIMD_URL)).rejects.toBeInstanceOf(
      OAuthInvalidClientMetadataError
    )

    vi.mocked(ctx.fetcher.fetch).mockResolvedValue(
      JSON.stringify({
        ...cimdDocument,
        redirect_uris: ['javascript:alert(1)'],
      })
    )
    await expect(ctx.service.resolveClient(CIMD_URL)).rejects.toBeInstanceOf(
      OAuthInvalidClientMetadataError
    )
  })

  it.each([
    [
      'a plaintext redirect URI that is not loopback',
      { redirect_uris: ['http://client.example/cb'] },
    ],
    ['a custom-scheme redirect URI', { redirect_uris: ['myapp:/cb'] }],
    [
      'a redirect URI with a fragment',
      { redirect_uris: ['https://client.example/cb#x'] },
    ],
    [
      'auth method private_key_jwt',
      { token_endpoint_auth_method: 'private_key_jwt' },
    ],
    [
      'auth method client_secret_basic',
      { token_endpoint_auth_method: 'client_secret_basic' },
    ],
    [
      'a grant type this server does not implement',
      { grant_types: ['authorization_code', 'client_credentials'] },
    ],
  ])('refuses a document with %s and stores nothing', async (_, patch) => {
    vi.mocked(ctx.fetcher.fetch).mockResolvedValue(
      JSON.stringify({ ...cimdDocument, ...patch })
    )

    await expect(ctx.service.resolveClient(CIMD_URL)).rejects.toBeInstanceOf(
      OAuthInvalidClientMetadataError
    )
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('refuses to refresh a cached row from a document that breaks the rules', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({
        metadataFetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      })
    )
    vi.mocked(ctx.fetcher.fetch).mockResolvedValue(
      JSON.stringify({ ...cimdDocument, redirect_uris: ['myapp:/cb'] })
    )

    await expect(ctx.service.resolveClient(CIMD_URL)).rejects.toBeInstanceOf(
      OAuthInvalidClientMetadataError
    )
    expect(ctx.clientRepository.update).not.toHaveBeenCalled()
  })

  it('refuses a client_id longer than its column without fetching it', async () => {
    const prefix = 'https://example.com/'
    const clientId = prefix + 'a'.repeat(256 - prefix.length)

    await expect(ctx.service.resolveClient(clientId)).rejects.toBeInstanceOf(
      OAuthInvalidClientError
    )
    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
    expect(ctx.clientRepository.findByClientId).not.toHaveBeenCalled()
  })

  it.each([
    ['a client_name longer than its column', { client_name: 'n'.repeat(256) }],
    [
      'a redirect URI longer than its column',
      { redirect_uris: [`https://client.example/${'a'.repeat(500)}`] },
    ],
  ])('refuses a document with %s and stores nothing', async (_, patch) => {
    vi.mocked(ctx.fetcher.fetch).mockResolvedValue(
      JSON.stringify({ ...cimdDocument, ...patch })
    )

    await expect(ctx.service.resolveClient(CIMD_URL)).rejects.toBeInstanceOf(
      OAuthInvalidClientMetadataError
    )
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('refuses a document it could not fetch at all', async () => {
    vi.mocked(ctx.fetcher.fetch).mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(ctx.service.resolveClient(CIMD_URL)).rejects.toBeInstanceOf(
      OAuthInvalidClientError
    )
  })
})

describe('OAuthService.resolveAuthorizationRequest', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
  })

  it('resolves a Claude Code request against its portless loopback registration', async () => {
    const resolved =
      await ctx.service.resolveAuthorizationRequest(authorizeParams())

    expect(resolved.client.clientId).toBe(CIMD_URL)
    expect(resolved.redirectUri).toBe('http://localhost:54321/callback')
    expect(resolved.scopes).toEqual(['pins:read', 'tags:read'])
    expect(resolved.resource).toBe(MCP_RESOURCE)
    expect(resolved.state).toBe('opaque-state')
  })

  it('rejects a malformed request as a validation failure', async () => {
    await expect(
      ctx.service.resolveAuthorizationRequest(
        authorizeParams({ code_challenge_method: 'plain' })
      )
    ).rejects.toBeInstanceOf(ValidationError)
  })

  // Nothing is redirected to a URI the client did not register, because the
  // redirect is where the code would be delivered.
  it.each([
    ['client_id', `https://example.com/${'a'.repeat(240)}`],
    ['redirect_uri', `http://localhost:54321/${'a'.repeat(500)}`],
    ['state', 's'.repeat(1025)],
    ['scope', 'pins:read '.repeat(103)],
  ])(
    'rejects a %s longer than it may be as a validation failure',
    async (field, value) => {
      await expect(
        ctx.service.resolveAuthorizationRequest(
          authorizeParams({ [field]: value })
        )
      ).rejects.toBeInstanceOf(ValidationError)
      expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
    }
  )

  it('rejects a redirect URI the client never registered', async () => {
    await expect(
      ctx.service.resolveAuthorizationRequest(
        authorizeParams({ redirect_uri: 'http://localhost:54321/evil' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidRequestError)
  })

  it.each([
    'https://client.example/cb/',
    'https://u@client.example/cb',
    'https://client.example/cb#frag',
    'https://client.example/x/../cb',
  ])(
    'rejects %s against a registered https://client.example/cb',
    async requested => {
      vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
        makeClient({
          clientId: 'static_hosted',
          redirectUris: ['https://client.example/cb'],
        })
      )

      await expect(
        ctx.service.resolveAuthorizationRequest(
          authorizeParams({
            client_id: 'static_hosted',
            redirect_uri: requested,
          })
        )
      ).rejects.toBeInstanceOf(OAuthInvalidRequestError)
    }
  )

  it('rejects a resource this server issues no tokens for', async () => {
    await expect(
      ctx.service.resolveAuthorizationRequest(
        authorizeParams({ resource: 'https://pinsquirrel.com' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidTargetError)
  })

  it('accepts a resource written differently but meaning the same thing', async () => {
    const resolved = await ctx.service.resolveAuthorizationRequest(
      authorizeParams({ resource: 'HTTPS://PinSquirrel.com/mcp/' })
    )

    expect(resolved.resource).toBe(MCP_RESOURCE)
  })

  it('rejects a scope that is not granted here', async () => {
    await expect(
      ctx.service.resolveAuthorizationRequest(
        authorizeParams({ scope: 'pins:read pins:administer' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidScopeError)
  })

  it('grants the write scopes to a client that asks for them', async () => {
    const resolved = await ctx.service.resolveAuthorizationRequest(
      authorizeParams({
        scope: 'pins:read tags:read pins:write tags:write',
      })
    )

    expect(resolved.scopes).toEqual([
      'pins:read',
      'tags:read',
      'pins:write',
      'tags:write',
    ])
  })

  // A write scope is never implied: it is granted because the client named it
  // and the user approved it on the consent screen (Decision 14).
  it('grants no write scope to a request that names none', async () => {
    const resolved =
      await ctx.service.resolveAuthorizationRequest(authorizeParams())

    expect(resolved.scopes).not.toContain('pins:write')
    expect(resolved.scopes).not.toContain('tags:write')
  })

  it('keeps offline_access, which is what buys a refresh token', async () => {
    const resolved = await ctx.service.resolveAuthorizationRequest(
      authorizeParams({ scope: 'pins:read offline_access' })
    )

    expect(resolved.scopes).toEqual(['pins:read', 'offline_access'])
  })

  it('rejects a client that is not registered for this grant', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({ clientId: 'dcr_ro', grantTypes: ['refresh_token'] })
    )

    await expect(
      ctx.service.resolveAuthorizationRequest(
        authorizeParams({ client_id: 'dcr_ro' })
      )
    ).rejects.toBeInstanceOf(OAuthUnauthorizedClientError)
  })
})

describe('OAuthService.authorize', () => {
  let ctx: ReturnType<typeof setup>
  let ac: AccessControl

  beforeEach(() => {
    ctx = setup()
    ac = new AccessControl(user)
  })

  it('starts a new grant with every approval', async () => {
    const approve = () =>
      ctx.service.authorize(ac, {
        params: authorizeParams(),
        userId: user.id,
        sessionId: SESSION_ID,
        approved: true,
      })

    await approve()
    await approve()

    const [first, second] = ctx.store.codes.map(code => code.grantId)
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(second).toMatch(/^[0-9a-f-]{36}$/)
    expect(second).not.toBe(first)
  })

  it('issues a code to the approved redirect URI and returns it once', async () => {
    const outcome = await ctx.service.authorize(ac, {
      params: authorizeParams(),
      userId: user.id,
      sessionId: SESSION_ID,
      approved: true,
    })

    expect(outcome.status).toBe('approved')
    if (outcome.status !== 'approved') return

    expect(outcome.redirectUri).toBe('http://localhost:54321/callback')
    expect(outcome.state).toBe('opaque-state')
    expect(outcome.issuer).toBe('https://pinsquirrel.com')
    expect(outcome.code).toBeTruthy()

    // The raw code is never stored, only its hash.
    expect(ctx.codeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codeHash: `hashed_${outcome.code}`,
        clientId: CIMD_URL,
        userId: user.id,
        redirectUri: 'http://localhost:54321/callback',
        codeChallenge: CODE_CHALLENGE,
        scopes: ['pins:read', 'tags:read'],
        resource: MCP_RESOURCE,
      }),
      SESSION_ID
    )
    const created = vi.mocked(ctx.codeRepository.create).mock.calls[0][0]
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('refuses when the session that approved the request has ended', async () => {
    vi.mocked(ctx.codeRepository.create).mockResolvedValue(null)

    await expect(
      ctx.service.authorize(ac, {
        params: authorizeParams(),
        userId: user.id,
        sessionId: SESSION_ID,
        approved: true,
      })
    ).rejects.toBeInstanceOf(OAuthAccessDeniedError)
    expect(ctx.clientRepository.markCompleted).not.toHaveBeenCalled()
  })

  // `completed_at` is what keeps a registration out of the incomplete-DCR
  // sweep, and an authorization is what completes it.
  it('marks the client as having completed an authorization', async () => {
    await ctx.service.authorize(ac, {
      params: authorizeParams(),
      userId: user.id,
      sessionId: SESSION_ID,
      approved: true,
    })

    expect(ctx.clientRepository.markCompleted).toHaveBeenCalledWith(
      'client-row-1',
      expect.any(Date)
    )
  })

  it('does not re-mark a client that already completed one', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({ completedAt: new Date('2026-01-01') })
    )

    await ctx.service.authorize(ac, {
      params: authorizeParams(),
      userId: user.id,
      sessionId: SESSION_ID,
      approved: true,
    })

    expect(ctx.clientRepository.markCompleted).not.toHaveBeenCalled()
  })

  // A denial is an outcome, not an exception: the client still has to be told,
  // and telling it means redirecting to a URI that was validated first.
  it('returns a denial carrying the validated redirect target', async () => {
    const outcome = await ctx.service.authorize(ac, {
      params: authorizeParams(),
      userId: user.id,
      sessionId: SESSION_ID,
      approved: false,
    })

    expect(outcome).toMatchObject({
      status: 'denied',
      error: 'access_denied',
      redirectUri: 'http://localhost:54321/callback',
      state: 'opaque-state',
      issuer: 'https://pinsquirrel.com',
    })
    expect(ctx.codeRepository.create).not.toHaveBeenCalled()
  })

  it.each(notAdmitted)(
    'refuses to issue a code to a user %s',
    async (_label, account) => {
      await expect(
        ctx.service.authorize(new AccessControl(account), {
          params: authorizeParams(),
          userId: account.id,
          sessionId: SESSION_ID,
          approved: true,
        })
      ).rejects.toBeInstanceOf(OAuthAccessDeniedError)
      expect(ctx.codeRepository.create).not.toHaveBeenCalled()
    }
  )

  it('refuses to issue a code on behalf of another user', async () => {
    await expect(
      ctx.service.authorize(new AccessControl(otherUser), {
        params: authorizeParams(),
        userId: user.id,
        sessionId: SESSION_ID,
        approved: true,
      })
    ).rejects.toBeInstanceOf(OAuthAccessDeniedError)
    expect(ctx.codeRepository.create).not.toHaveBeenCalled()
  })
})

describe('OAuthService.exchangeAuthorizationCode', () => {
  let ctx: ReturnType<typeof setup>

  function tokenParams(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      grant_type: 'authorization_code',
      code: 'raw-code',
      redirect_uri: 'http://localhost:54321/callback',
      client_id: CIMD_URL,
      code_verifier: CODE_VERIFIER,
      ...overrides,
    }
  }

  const offlineScopes = ['pins:read', 'offline_access']

  beforeEach(() => {
    ctx = setup()
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient()
    )
    ctx.store.codes.push(makeCode())
  })

  it('exchanges a code for an access token bound to the requested resource', async () => {
    const issued = await ctx.service.exchangeAuthorizationCode(tokenParams())

    expect(issued.tokenType).toBe('Bearer')
    // Identifiable on sight if it is ever leaked or logged.
    expect(issued.accessToken.startsWith('pso_')).toBe(true)
    expect(issued.scopes).toEqual(['pins:read', 'tags:read'])
    expect(issued.resource).toBe(MCP_RESOURCE)
    expect(issued.expiresIn).toBeGreaterThan(0)

    expect(ctx.store.codes[0].consumedAt).toBeInstanceOf(Date)
    expect(ctx.store.tokens).toEqual([
      expect.objectContaining({
        kind: 'access',
        tokenHash: `hashed_${issued.accessToken}`,
        clientId: CIMD_URL,
        userId: user.id,
        scopes: ['pins:read', 'tags:read'],
        resource: MCP_RESOURCE,
      }),
    ])
  })

  it('issues no refresh token when offline_access was not granted', async () => {
    const issued = await ctx.service.exchangeAuthorizationCode(tokenParams())

    expect(issued.refreshToken).toBeNull()
    expect(ctx.store.tokens).toHaveLength(1)
  })

  it('issues a refresh token bound to the same resource when offline_access was granted', async () => {
    ctx.store.codes[0].scopes = offlineScopes

    const issued = await ctx.service.exchangeAuthorizationCode(tokenParams())

    expect(issued.refreshToken).toBeTruthy()
    expect(ctx.store.tokens).toContainEqual(
      expect.objectContaining({
        kind: 'refresh',
        tokenHash: `hashed_${issued.refreshToken ?? ''}`,
        resource: MCP_RESOURCE,
      })
    )
  })

  it('hands the grant the code started on to both tokens', async () => {
    ctx.store.codes[0].scopes = offlineScopes
    ctx.store.codes[0].grantId = 'grant-from-consent'

    await ctx.service.exchangeAuthorizationCode(tokenParams())

    expect(ctx.store.tokens.map(token => [token.kind, token.grantId])).toEqual([
      ['access', 'grant-from-consent'],
      ['refresh', 'grant-from-consent'],
    ])
  })

  it('refuses a code that never existed', async () => {
    await expect(
      ctx.service.exchangeAuthorizationCode(tokenParams({ code: 'unknown' }))
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
    expect(ctx.store.tokens).toEqual([])
  })

  it('refuses an expired code', async () => {
    ctx.store.codes[0].expiresAt = new Date(Date.now() - 1000)

    await expect(
      ctx.service.exchangeAuthorizationCode(tokenParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
    expect(ctx.store.tokens).toEqual([])
  })

  // A code presented twice was seen by two parties, and there is no telling
  // which one holds the tokens it produced (RFC 6749 4.1.2).
  describe('a code presented a second time', () => {
    beforeEach(() => {
      ctx.store.codes[0].scopes = offlineScopes
      ctx.store.codes[0].grantId = 'grant-laptop'
      seedDevice(ctx.store, 'desktop')
    })

    it('is refused, and the tokens of its first exchange with it', async () => {
      const first = await ctx.service.exchangeAuthorizationCode(tokenParams())

      await expect(
        ctx.service.exchangeAuthorizationCode(tokenParams())
      ).rejects.toBeInstanceOf(OAuthInvalidGrantError)

      expect(
        await ctx.service.verifyAccessToken(first.accessToken, MCP_RESOURCE)
      ).toBeNull()
      await expect(
        ctx.service.exchangeRefreshToken({
          grant_type: 'refresh_token',
          refresh_token: first.refreshToken,
          client_id: CIMD_URL,
        })
      ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
      expect(liveTokenIds(ctx.store)).toEqual([
        'desktop-access',
        'desktop-refresh',
      ])
    })

    it('ends the first exchange when the two arrive together', async () => {
      const outcomes = await Promise.allSettled([
        ctx.service.exchangeAuthorizationCode(tokenParams()),
        ctx.service.exchangeAuthorizationCode(tokenParams()),
      ])

      expect(outcomes.map(outcome => outcome.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ])
      expect(liveTokenIds(ctx.store)).toEqual([
        'desktop-access',
        'desktop-refresh',
      ])
    })

    it('ends everything the client holds when the code has no grant id', async () => {
      ctx.store.codes[0].grantId = null
      await ctx.service.exchangeAuthorizationCode(tokenParams())

      await expect(
        ctx.service.exchangeAuthorizationCode(tokenParams())
      ).rejects.toBeInstanceOf(OAuthInvalidGrantError)

      expect(liveTokenIds(ctx.store)).toEqual([])
    })
  })

  it('leaves the code usable when its tokens cannot be written', async () => {
    vi.mocked(ctx.codeRepository.exchange).mockRejectedValueOnce(
      new Error('lost connection to MySQL')
    )
    await expect(
      ctx.service.exchangeAuthorizationCode(tokenParams())
    ).rejects.toThrow('lost connection to MySQL')

    const issued = await ctx.service.exchangeAuthorizationCode(tokenParams())

    expect(issued.accessToken).toBeTruthy()
    expect(ctx.store.tokens).toHaveLength(1)
  })

  it('leaves the code usable when the account could not be looked up', async () => {
    vi.mocked(ctx.userRepository.findById).mockRejectedValueOnce(
      new Error('lost connection to MySQL')
    )
    await expect(
      ctx.service.exchangeAuthorizationCode(tokenParams())
    ).rejects.toThrow('lost connection to MySQL')

    const issued = await ctx.service.exchangeAuthorizationCode(tokenParams())

    expect(issued.accessToken).toBeTruthy()
  })

  it.each(notAdmitted)(
    'refuses a code for a user %s and revokes what the client holds',
    async (_label, account) => {
      vi.mocked(ctx.userRepository.findById).mockResolvedValue(account)
      seedDevice(ctx.store, 'laptop')

      await expect(
        ctx.service.exchangeAuthorizationCode(tokenParams())
      ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
      expect(ctx.store.tokens).toHaveLength(2)
      expect(liveTokenIds(ctx.store)).toEqual([])
    }
  )

  it('refuses a verifier that does not hash to the stored challenge, and spends the code', async () => {
    await expect(
      ctx.service.exchangeAuthorizationCode(
        tokenParams({
          code_verifier: 'V-a-s-t-l-y-different-but-still-a-valid-PKCE-value',
        })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
    expect(ctx.store.tokens).toEqual([])
    expect(ctx.store.codes[0].consumedAt).toBeInstanceOf(Date)
  })

  it('refuses a code presented by a different client', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({ clientId: 'dcr_other' })
    )

    await expect(
      ctx.service.exchangeAuthorizationCode(
        tokenParams({ client_id: 'dcr_other' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
    expect(ctx.store.tokens).toEqual([])
  })

  it('refuses a redirect URI that is not the one the code was issued to', async () => {
    await expect(
      ctx.service.exchangeAuthorizationCode(
        tokenParams({ redirect_uri: 'http://localhost:54321/elsewhere' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
    expect(ctx.store.tokens).toEqual([])
  })

  // RFC 6749 4.1.3: identical to the authorization request's, so the loopback
  // port allowance that applies against a registration does not apply here.
  it.each([
    ['another loopback port', 'http://localhost:9999/callback'],
    ['a trailing slash', 'http://localhost:54321/callback/'],
  ])(
    'refuses a redirect URI that differs from the code by %s',
    async (_label, redirectUri) => {
      await expect(
        ctx.service.exchangeAuthorizationCode(
          tokenParams({ redirect_uri: redirectUri })
        )
      ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
      expect(ctx.store.tokens).toEqual([])
    }
  )

  // RFC 8707: a repeated `resource` has to be the one the code was bound to,
  // or the exchange would be a way to swap audiences after consent.
  it('refuses a resource other than the one consent was given for', async () => {
    await expect(
      ctx.service.exchangeAuthorizationCode(
        tokenParams({ resource: API_RESOURCE })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidTargetError)
    expect(ctx.store.tokens).toEqual([])
  })

  it('accepts the resource repeated in a different but equivalent spelling', async () => {
    const issued = await ctx.service.exchangeAuthorizationCode(
      tokenParams({ resource: 'https://pinsquirrel.com/mcp/' })
    )

    expect(issued.resource).toBe(MCP_RESOURCE)
  })

  it('rejects a malformed token request as a validation failure', async () => {
    await expect(
      ctx.service.exchangeAuthorizationCode(
        tokenParams({ code_verifier: undefined })
      )
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('OAuthService.exchangeRefreshToken', () => {
  let ctx: ReturnType<typeof setup>

  const refreshScopes = ['pins:read', 'tags:read', 'offline_access']
  const longAgo = () => new Date(Date.now() - 5 * 60 * 1000)

  function refreshParams(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      grant_type: 'refresh_token',
      refresh_token: 'laptop-refresh',
      client_id: CIMD_URL,
      ...overrides,
    }
  }

  const presented = () => {
    const token = ctx.store.tokens.find(t => t.id === 'laptop-refresh')
    if (!token) throw new Error('The presented token was not seeded')
    return token
  }

  const successors = () =>
    ctx.store.tokens.filter(token => token.id.startsWith('token-'))

  beforeEach(() => {
    ctx = setup()
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient()
    )
    seedDevice(ctx.store, 'laptop')
  })

  // OAuth 2.1 requires rotation for public clients, and both CIMD and DCR
  // register Claude as one.
  it('issues a new refresh token and retires the one presented', async () => {
    const issued = await ctx.service.exchangeRefreshToken(refreshParams())

    expect(issued.refreshToken).toBeTruthy()
    expect(issued.refreshToken).not.toBe('laptop-refresh')
    expect(presented().rotatedAt).toBeInstanceOf(Date)
    expect(successors()).toContainEqual(
      expect.objectContaining({
        kind: 'refresh',
        tokenHash: `hashed_${issued.refreshToken ?? ''}`,
        rotatedFrom: 'laptop-refresh',
        resource: MCP_RESOURCE,
        scopes: refreshScopes,
      })
    )
  })

  it('issues an access token for the same audience', async () => {
    const issued = await ctx.service.exchangeRefreshToken(refreshParams())

    expect(issued.accessToken.startsWith('pso_')).toBe(true)
    expect(issued.resource).toBe(MCP_RESOURCE)
  })

  it('keeps the successors in the grant of the token presented', async () => {
    await ctx.service.exchangeRefreshToken(refreshParams())

    expect(successors().map(token => [token.kind, token.grantId])).toEqual([
      ['access', 'grant-laptop'],
      ['refresh', 'grant-laptop'],
    ])
  })

  it('kills the grant when a rotated token is presented again, and no other', async () => {
    presented().rotatedAt = longAgo()
    seedDevice(ctx.store, 'desktop')

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)

    expect(liveTokenIds(ctx.store)).toEqual([
      'desktop-access',
      'desktop-refresh',
    ])
    expect(successors()).toEqual([])
  })

  it('kills everything the client holds when the replayed token has no grant id', async () => {
    presented().rotatedAt = longAgo()
    presented().grantId = null
    seedDevice(ctx.store, 'desktop')

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)

    expect(liveTokenIds(ctx.store)).toEqual([])
  })

  it('refuses a token presented again moments after it was rotated, and leaves the grant alone', async () => {
    presented().rotatedAt = new Date(Date.now() - 5 * 1000)

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)

    expect(liveTokenIds(ctx.store)).toEqual(['laptop-access', 'laptop-refresh'])
    expect(successors()).toEqual([])
  })

  it('kills the grant once that moment has passed', async () => {
    presented().rotatedAt = new Date(
      Date.now() - REFRESH_ROTATION_GRACE_MS - 1000
    )

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)

    expect(liveTokenIds(ctx.store)).toEqual([])
  })

  it('lets one of two concurrent refreshes of a token win, and its tokens stay live', async () => {
    const outcomes = await Promise.allSettled([
      ctx.service.exchangeRefreshToken(refreshParams()),
      ctx.service.exchangeRefreshToken(refreshParams()),
    ])

    const won = outcomes.filter(outcome => outcome.status === 'fulfilled')
    const lost = outcomes.filter(outcome => outcome.status === 'rejected')
    expect(won).toHaveLength(1)
    expect(lost).toHaveLength(1)
    expect(lost[0].reason).toBeInstanceOf(OAuthInvalidGrantError)

    const { accessToken, refreshToken } = won[0].value
    expect(
      await ctx.service.verifyAccessToken(accessToken, MCP_RESOURCE)
    ).not.toBeNull()
    const next = await ctx.service.exchangeRefreshToken(
      refreshParams({ refresh_token: refreshToken })
    )
    expect(next.refreshToken).toBeTruthy()
    expect(successors()).toHaveLength(4)
  })

  it('issues nothing when the token is revoked while it is being refreshed', async () => {
    const rotate = vi.mocked(ctx.tokenRepository.rotate)
    const real = rotate.getMockImplementation()
    rotate.mockImplementationOnce((...args) => {
      presented().revokedAt = new Date()
      return real?.(...args) ?? Promise.resolve(false)
    })

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
    expect(successors()).toEqual([])
  })

  it('leaves the token usable when its successors cannot be written', async () => {
    vi.mocked(ctx.tokenRepository.rotate).mockRejectedValueOnce(
      new Error('lost connection to MySQL')
    )
    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toThrow('lost connection to MySQL')

    const issued = await ctx.service.exchangeRefreshToken(refreshParams())

    expect(issued.refreshToken).toBeTruthy()
    expect(ctx.store.tokens.some(token => token.revokedAt)).toBe(false)
  })

  it('gives a token from before grant ids, and its successors, a grant of their own', async () => {
    presented().grantId = null

    await ctx.service.exchangeRefreshToken(refreshParams())

    const adopted = presented().grantId
    expect(adopted).toMatch(/^[0-9a-f-]{36}$/)
    expect(successors().map(token => token.grantId)).toEqual([adopted, adopted])
  })

  it.each(notAdmitted)(
    'refuses a user %s and revokes what the client holds',
    async (_label, account) => {
      vi.mocked(ctx.userRepository.findById).mockResolvedValue(account)

      await expect(
        ctx.service.exchangeRefreshToken(refreshParams())
      ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
      expect(successors()).toEqual([])
      expect(presented().rotatedAt).toBeNull()
      expect(liveTokenIds(ctx.store)).toEqual([])
    }
  )

  it('refuses a token the user revoked', async () => {
    presented().revokedAt = new Date()

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  it('refuses an expired token', async () => {
    presented().expiresAt = new Date(Date.now() - 1000)

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  it('refuses an access token presented as a refresh token', async () => {
    await expect(
      ctx.service.exchangeRefreshToken(
        refreshParams({ refresh_token: 'laptop-access' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  it('refuses a token that belongs to another client', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({ clientId: 'dcr_other' })
    )

    await expect(
      ctx.service.exchangeRefreshToken(
        refreshParams({ client_id: 'dcr_other' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  it('refuses a token nothing is stored for', async () => {
    await expect(
      ctx.service.exchangeRefreshToken(
        refreshParams({ refresh_token: 'unknown' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  // RFC 6749 section 6: a refresh may ask for a narrower access token, and
  // the refresh token that replaces the old one keeps the grant's scope.
  describe('a refresh that asks for less than the grant holds', () => {
    const stored = (raw: string | null) =>
      ctx.store.tokens.find(token => token.tokenHash === `hashed_${raw ?? ''}`)

    it('narrows the access token and leaves the grant as it was', async () => {
      const issued = await ctx.service.exchangeRefreshToken(
        refreshParams({ scope: 'pins:read offline_access' })
      )

      expect(issued.scopes).toEqual(['pins:read', 'offline_access'])
      expect(stored(issued.accessToken)?.scopes).toEqual([
        'pins:read',
        'offline_access',
      ])
      expect(stored(issued.refreshToken)?.scopes).toEqual(refreshScopes)
    })

    it('still issues a successor when the request leaves out offline_access', async () => {
      const issued = await ctx.service.exchangeRefreshToken(
        refreshParams({ scope: 'pins:read' })
      )

      expect(issued.scopes).toEqual(['pins:read'])
      expect(stored(issued.accessToken)?.scopes).toEqual(['pins:read'])
      expect(stored(issued.refreshToken)?.scopes).toEqual(refreshScopes)
    })

    it('can ask for the whole grant again on the next refresh', async () => {
      const narrowed = await ctx.service.exchangeRefreshToken(
        refreshParams({ scope: 'pins:read' })
      )

      const widened = await ctx.service.exchangeRefreshToken(
        refreshParams({ refresh_token: narrowed.refreshToken })
      )

      expect(widened.scopes).toEqual(refreshScopes)
    })
  })

  it('refuses a client that is no longer registered for refresh_token, and retires nothing', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({ grantTypes: ['authorization_code'] })
    )

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthUnauthorizedClientError)

    expect(presented().rotatedAt).toBeNull()
    expect(successors()).toEqual([])
    expect(liveTokenIds(ctx.store)).toEqual(['laptop-access', 'laptop-refresh'])
  })

  it('refuses a refresh that asks for more than was granted', async () => {
    await expect(
      ctx.service.exchangeRefreshToken(
        refreshParams({
          scope: 'pins:read tags:read offline_access pins:write',
        })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidScopeError)
  })

  it('refuses a refresh aimed at a different audience', async () => {
    await expect(
      ctx.service.exchangeRefreshToken(
        refreshParams({ resource: API_RESOURCE })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidTargetError)
  })

  it('rejects a malformed refresh request as a validation failure', async () => {
    await expect(
      ctx.service.exchangeRefreshToken(refreshParams({ refresh_token: '' }))
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('OAuthService.verifyAccessToken', () => {
  let ctx: ReturnType<typeof setup>

  function storedAccess(overrides: Partial<OAuthToken> = {}): OAuthToken {
    return makeToken(
      {
        tokenHash: 'hashed_pso_raw',
        kind: 'access',
        clientId: CIMD_URL,
        userId: user.id,
        scopes: ['pins:read', 'tags:read'],
        resource: MCP_RESOURCE,
        expiresAt: new Date(Date.now() + 60_000),
      },
      { id: 'access-1', ...overrides }
    )
  }

  beforeEach(() => {
    ctx = setup()
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      storedAccess()
    )
    vi.mocked(ctx.userRepository.findById).mockResolvedValue(user)
  })

  // One call resolves the token and the account, which is why the middleware
  // over this needs no repository.
  it('resolves a live token to its principal', async () => {
    const result = await ctx.service.verifyAccessToken('pso_raw', MCP_RESOURCE)

    expect(ctx.tokenRepository.findByTokenHash).toHaveBeenCalledWith(
      'hashed_pso_raw'
    )
    expect(result).toMatchObject({
      user,
      clientId: CIMD_URL,
      scopes: ['pins:read', 'tags:read'],
    })
    expect(result?.token.id).toBe('access-1')
  })

  // The confused-deputy defense: `/mcp` and `/api/v1` are separate audiences
  // and neither accepts the other's token.
  it('refuses a token minted for the other resource', async () => {
    expect(await ctx.service.verifyAccessToken('pso_raw', API_RESOURCE)).toBe(
      null
    )
  })

  it('compares the audience after normalizing both sides', async () => {
    expect(
      await ctx.service.verifyAccessToken(
        'pso_raw',
        'HTTPS://PinSquirrel.com/mcp/'
      )
    ).not.toBe(null)
  })

  it('refuses an expired token', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      storedAccess({ expiresAt: new Date(Date.now() - 1000) })
    )

    expect(await ctx.service.verifyAccessToken('pso_raw', MCP_RESOURCE)).toBe(
      null
    )
  })

  it('refuses a revoked token', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      storedAccess({ revokedAt: new Date() })
    )

    expect(await ctx.service.verifyAccessToken('pso_raw', MCP_RESOURCE)).toBe(
      null
    )
  })

  it('refuses a refresh token presented as a bearer credential', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      storedAccess({ kind: 'refresh' })
    )

    expect(await ctx.service.verifyAccessToken('pso_raw', MCP_RESOURCE)).toBe(
      null
    )
  })

  it('refuses a token nothing is stored for', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(null)

    expect(await ctx.service.verifyAccessToken('pso_raw', MCP_RESOURCE)).toBe(
      null
    )
  })

  it.each(notAdmitted)(
    'refuses a token whose user is %s',
    async (_label, account) => {
      vi.mocked(ctx.userRepository.findById).mockResolvedValue(account)

      expect(await ctx.service.verifyAccessToken('pso_raw', MCP_RESOURCE)).toBe(
        null
      )
    }
  )

  // A distinct answer would confirm the token itself was good.
  it('reads a token whose user is gone as an invalid token', async () => {
    vi.mocked(ctx.userRepository.findById).mockResolvedValue(null)

    expect(await ctx.service.verifyAccessToken('pso_raw', MCP_RESOURCE)).toBe(
      null
    )
  })
})

describe('OAuthService.registerClient', () => {
  let ctx: ReturnType<typeof setup>

  function registration(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      client_name: 'Some MCP Client',
      redirect_uris: ['http://localhost:54321/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none',
      ...overrides,
    }
  }

  beforeEach(() => {
    ctx = setup()
  })

  it('registers a client under an identifier this server derived', async () => {
    const client = await ctx.service.registerClient(registration())

    expect(ctx.clientRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: 'Some MCP Client',
        redirectUris: ['http://localhost:54321/callback'],
        registrationType: 'dcr',
        tokenEndpointAuthMethod: 'none',
        metadataUrl: null,
      })
    )
    expect(client.clientId.startsWith('dcr_')).toBe(true)
  })

  // Claude Code registers a fresh ephemeral port on every connection. Byte
  // equality would store a row per connection, which is what dedup is for.
  it('gives the same identifier to a re-registration on a new loopback port', async () => {
    const first = await ctx.service.registerClient(registration())

    const second = await ctx.service.registerClient(
      registration({ redirect_uris: ['http://localhost:9999/callback'] })
    )

    expect(second.clientId).toBe(first.clientId)
  })

  it('returns the existing row rather than creating a second one', async () => {
    const first = await ctx.service.registerClient(registration())
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(first)
    vi.mocked(ctx.clientRepository.create).mockClear()

    const second = await ctx.service.registerClient(registration())

    expect(second).toBe(first)
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('keeps different clients apart, port aside', async () => {
    const first = await ctx.service.registerClient(registration())

    const other = await ctx.service.registerClient(
      registration({ redirect_uris: ['http://localhost:54321/elsewhere'] })
    )
    const hosted = await ctx.service.registerClient(
      registration({ redirect_uris: ['https://example.com/callback'] })
    )

    expect(other.clientId).not.toBe(first.clientId)
    expect(hosted.clientId).not.toBe(first.clientId)
  })

  it('refuses a plaintext redirect URI that is not loopback', async () => {
    await expect(
      ctx.service.registerClient(
        registration({ redirect_uris: ['http://example.com/callback'] })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidClientMetadataError)
  })

  it('refuses a redirect URI with a fragment', async () => {
    await expect(
      ctx.service.registerClient(
        registration({ redirect_uris: ['https://example.com/callback#x'] })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidClientMetadataError)
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('refuses an authentication method this server does not advertise', async () => {
    await expect(
      ctx.service.registerClient(
        registration({ token_endpoint_auth_method: 'client_secret_post' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidClientMetadataError)
  })

  it('refuses a grant type this server does not implement', async () => {
    await expect(
      ctx.service.registerClient(
        registration({ grant_types: ['client_credentials'] })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidClientMetadataError)
  })

  it('refuses a client_name longer than its column before creating a row', async () => {
    await expect(
      ctx.service.registerClient(registration({ client_name: 'n'.repeat(256) }))
    ).rejects.toBeInstanceOf(ValidationError)
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('refuses a redirect URI longer than its column before creating a row', async () => {
    const prefix = 'http://localhost:54321/'
    const uri = prefix + 'a'.repeat(513 - prefix.length)

    await expect(
      ctx.service.registerClient(registration({ redirect_uris: [uri] }))
    ).rejects.toBeInstanceOf(ValidationError)
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('rejects a malformed registration as a validation failure', async () => {
    await expect(
      ctx.service.registerClient({ redirect_uris: [] })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('refuses more redirect URIs than a client needs', async () => {
    const redirectUris = Array.from(
      { length: 50 },
      (_, i) => `https://client.example/cb/${String(i)}`
    )

    await expect(
      ctx.service.registerClient(registration({ redirect_uris: redirectUris }))
    ).rejects.toBeInstanceOf(ValidationError)
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('refuses a redirect URI longer than 512 characters', async () => {
    const longUri = `https://client.example/${'a'.repeat(600)}`

    await expect(
      ctx.service.registerClient(registration({ redirect_uris: [longUri] }))
    ).rejects.toBeInstanceOf(ValidationError)
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })
})

describe('OAuthService grants', () => {
  let ctx: ReturnType<typeof setup>
  let ac: AccessControl

  function grantToken(overrides: Partial<OAuthToken> = {}): OAuthToken {
    return makeToken(
      {
        tokenHash: 'hashed_x',
        kind: 'access',
        clientId: CIMD_URL,
        userId: user.id,
        scopes: ['pins:read', 'tags:read'],
        resource: MCP_RESOURCE,
        expiresAt: new Date(Date.now() + 60_000),
      },
      overrides
    )
  }

  beforeEach(() => {
    ctx = setup()
    ac = new AccessControl(user)
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient()
    )
  })

  // One authorization mints an access token and a refresh token. The profile
  // page shows the app, not the plumbing.
  it('lists one grant per client, not one per token', async () => {
    vi.mocked(ctx.tokenRepository.findActiveByUserId).mockResolvedValue([
      grantToken({ id: 'access-1' }),
      grantToken({ id: 'refresh-1', kind: 'refresh', tokenHash: 'hashed_y' }),
    ])

    const grants = await ctx.service.listGrants(ac, user.id)

    expect(grants).toHaveLength(1)
    expect(grants[0]).toMatchObject({
      clientId: CIMD_URL,
      clientName: 'Claude Code',
      resources: [MCP_RESOURCE],
      scopes: ['pins:read', 'tags:read'],
    })
  })

  // Revoking takes every token the client holds, whatever the audience, so a
  // row per audience would promise a granularity the Revoke button does not
  // have. One row per client, saying everything it can reach.
  it('folds a client authorized for both audiences into one grant', async () => {
    vi.mocked(ctx.tokenRepository.findActiveByUserId).mockResolvedValue([
      grantToken({ id: 'access-1', scopes: ['pins:read'] }),
      grantToken({
        id: 'access-2',
        resource: API_RESOURCE,
        scopes: ['pins:read', 'tags:read'],
      }),
    ])

    const grants = await ctx.service.listGrants(ac, user.id)

    expect(grants).toHaveLength(1)
    expect(grants[0]).toMatchObject({
      resources: [MCP_RESOURCE, API_RESOURCE],
      scopes: ['pins:read', 'tags:read'],
    })
  })

  it.each([
    ['access first', ['access', 'refresh']],
    ['refresh first', ['refresh', 'access']],
  ] as const)(
    'reports when the longest-lived token expires (%s)',
    async (_order, kinds) => {
      const createdAt = new Date()
      const accessExpiry = new Date(createdAt.getTime() + 60 * 60 * 1000)
      const refreshExpiry = new Date(
        createdAt.getTime() + 30 * 24 * 60 * 60 * 1000
      )
      vi.mocked(ctx.tokenRepository.findActiveByUserId).mockResolvedValue(
        kinds.map(kind =>
          grantToken({
            id: `${kind}-1`,
            kind,
            createdAt,
            expiresAt: kind === 'refresh' ? refreshExpiry : accessExpiry,
          })
        )
      )

      const [grant] = await ctx.service.listGrants(ac, user.id)

      expect(grant.expiresAt).toEqual(refreshExpiry)
    }
  )

  it('keeps grants for different clients apart', async () => {
    vi.mocked(ctx.tokenRepository.findActiveByUserId).mockResolvedValue([
      grantToken({ id: 'access-1' }),
      grantToken({ id: 'access-2', clientId: 'dcr_other' }),
    ])

    expect(await ctx.service.listGrants(ac, user.id)).toHaveLength(2)
  })

  it("refuses to list another user's grants", async () => {
    await expect(
      ctx.service.listGrants(new AccessControl(otherUser), user.id)
    ).rejects.toBeInstanceOf(OAuthAccessDeniedError)
    expect(ctx.tokenRepository.findActiveByUserId).not.toHaveBeenCalled()
  })

  // Revoking has to take the access token and the refresh token together, or
  // the client keeps working until the access token expires.
  it('revokes every token the client holds for the user', async () => {
    vi.mocked(ctx.tokenRepository.revokeByUserAndClient).mockResolvedValue(2)

    await ctx.service.revokeGrant(ac, user.id, CIMD_URL)

    expect(ctx.tokenRepository.revokeByUserAndClient).toHaveBeenCalledWith(
      user.id,
      CIMD_URL
    )
  })

  it('revokes every grant of that client, and no other client', async () => {
    seedDevice(ctx.store, 'laptop')
    seedDevice(ctx.store, 'desktop')
    seedDevice(ctx.store, 'other', { clientId: 'dcr_other' })

    await ctx.service.revokeGrant(ac, user.id, CIMD_URL)

    expect(liveTokenIds(ctx.store)).toEqual(['other-access', 'other-refresh'])
  })

  it('revokes without looking up any single token', async () => {
    vi.mocked(ctx.tokenRepository.findById).mockResolvedValue(null)
    vi.mocked(ctx.tokenRepository.revokeByUserAndClient).mockResolvedValue(2)

    await expect(
      ctx.service.revokeGrant(ac, user.id, CIMD_URL)
    ).resolves.toBeUndefined()
  })

  it("refuses to revoke another user's grant", async () => {
    await expect(
      ctx.service.revokeGrant(new AccessControl(otherUser), user.id, CIMD_URL)
    ).rejects.toBeInstanceOf(OAuthAccessDeniedError)
    expect(ctx.tokenRepository.revokeByUserAndClient).not.toHaveBeenCalled()
  })

  it('refuses to revoke a client that holds no live token', async () => {
    vi.mocked(ctx.tokenRepository.revokeByUserAndClient).mockResolvedValue(0)

    await expect(
      ctx.service.revokeGrant(ac, user.id, 'dcr_none')
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })
})

describe('OAuthService.revokeToken', () => {
  let ctx: ReturnType<typeof setup>

  beforeEach(() => {
    ctx = setup()
    seedDevice(ctx.store, 'laptop')
    seedDevice(ctx.store, 'desktop')
  })

  it('revokes the access token a client hands back', async () => {
    await ctx.service.revokeToken({
      token: 'laptop-access',
      client_id: CIMD_URL,
    })

    expect(liveTokenIds(ctx.store)).toEqual([
      'laptop-refresh',
      'desktop-access',
      'desktop-refresh',
    ])
  })

  // RFC 7009: revoking a refresh token takes the access tokens of the same
  // grant with it, or the client keeps working for the rest of the hour. The
  // same application on another device is another grant.
  it('takes the whole grant when the token handed back is a refresh token, and no other', async () => {
    await ctx.service.revokeToken({
      token: 'laptop-refresh',
      client_id: CIMD_URL,
    })

    expect(liveTokenIds(ctx.store)).toEqual([
      'desktop-access',
      'desktop-refresh',
    ])
  })

  it('takes everything the client holds when the refresh token has no grant id', async () => {
    for (const token of ctx.store.tokens) {
      if (token.id.startsWith('laptop-')) token.grantId = null
    }

    await ctx.service.revokeToken({
      token: 'laptop-refresh',
      client_id: CIMD_URL,
    })

    expect(liveTokenIds(ctx.store)).toEqual([])
  })

  // RFC 7009 4.1.1: an unknown token is a success, so revocation cannot be
  // used to find out which tokens exist.
  it('says nothing about a token it does not know', async () => {
    await expect(
      ctx.service.revokeToken({ token: 'unknown' })
    ).resolves.toBeUndefined()
    expect(liveTokenIds(ctx.store)).toHaveLength(4)
  })

  it('leaves a token that belongs to another client alone, and still says nothing', async () => {
    await expect(
      ctx.service.revokeToken({
        token: 'laptop-access',
        client_id: 'dcr_someone_else',
      })
    ).resolves.toBeUndefined()
    expect(liveTokenIds(ctx.store)).toHaveLength(4)
  })
})

describe('OAuthService.reconcileStaticClients', () => {
  let ctx: ReturnType<typeof setup>

  const acme = {
    clientId: 'acme-connector',
    clientName: 'Acme Connector',
    redirectUris: ['https://acme.example.com/callback'],
  }

  beforeEach(() => {
    ctx = setup()
  })

  it('registers a pre-registered client the table has never seen', async () => {
    await ctx.service.reconcileStaticClients([acme])

    expect(ctx.clientRepository.create).toHaveBeenCalledWith({
      clientId: 'acme-connector',
      clientName: 'Acme Connector',
      redirectUris: ['https://acme.example.com/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      tokenEndpointAuthMethod: 'none',
      registrationType: 'static',
      metadataUrl: null,
      metadataFetchedAt: null,
    })
  })

  it('follows the operator when the name or the redirect URIs change', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({
        id: 'client-row-static',
        clientId: 'acme-connector',
        clientName: 'Acme',
        redirectUris: ['https://acme.example.com/old'],
        registrationType: 'static',
        metadataUrl: null,
        metadataFetchedAt: null,
      })
    )

    await ctx.service.reconcileStaticClients([acme])

    expect(ctx.clientRepository.update).toHaveBeenCalledWith(
      'client-row-static',
      {
        clientName: 'Acme Connector',
        redirectUris: ['https://acme.example.com/callback'],
      }
    )
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('writes nothing when the row already says what the config says', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({
        id: 'client-row-static',
        clientId: 'acme-connector',
        clientName: 'Acme Connector',
        redirectUris: ['https://acme.example.com/callback'],
        registrationType: 'static',
        metadataUrl: null,
        metadataFetchedAt: null,
      })
    )

    await ctx.service.reconcileStaticClients([acme])

    expect(ctx.clientRepository.update).not.toHaveBeenCalled()
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  // Removing an entry from the config must not take the grants with it: a row
  // deleted here would revoke every token issued to that client by cascade.
  it('never deletes a client that has dropped out of the config', async () => {
    await ctx.service.reconcileStaticClients([])

    expect(ctx.clientRepository.delete).not.toHaveBeenCalled()
  })

  it('refuses a redirect URI with a fragment', async () => {
    await expect(
      ctx.service.reconcileStaticClients([
        { ...acme, redirectUris: ['https://acme.example.com/callback#x'] },
      ])
    ).rejects.toThrow(OAuthInvalidClientMetadataError)
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('refuses a redirect URI this server would never redirect to', async () => {
    await expect(
      ctx.service.reconcileStaticClients([
        { ...acme, redirectUris: ['http://acme.example.com/callback'] },
      ])
    ).rejects.toThrow(OAuthInvalidClientMetadataError)
  })
})

/**
 * Claude gives discovery, registration and a token exchange 10 seconds, and a
 * refresh 30. A CIMD fetch has its own 10 second timeout, so a token request
 * that waited on one could spend the whole budget before it starts.
 */
describe('OAuthService token requests and the latency budget', () => {
  let ctx: ReturnType<typeof setup>

  /** Registered from a metadata document a full day ago: the cache is stale. */
  const staleClient = () =>
    makeClient({
      metadataFetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    })

  beforeEach(() => {
    ctx = setup()
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      staleClient()
    )
    ctx.store.codes.push(makeCode())
  })

  it('exchanges a code without waiting on the client metadata document', async () => {
    const issued = await ctx.service.exchangeAuthorizationCode({
      grant_type: 'authorization_code',
      code: 'raw-code',
      redirect_uri: 'http://localhost:54321/callback',
      client_id: CIMD_URL,
      code_verifier: CODE_VERIFIER,
    })

    expect(issued.accessToken.startsWith('pso_')).toBe(true)
    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })

  it('refreshes without waiting on the client metadata document', async () => {
    seedDevice(ctx.store, 'laptop')

    await ctx.service.exchangeRefreshToken({
      grant_type: 'refresh_token',
      refresh_token: 'laptop-refresh',
      client_id: CIMD_URL,
    })

    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })

  it('refuses a code exchange for a client it has no row for, without fetching or storing it', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(null)

    await expect(
      ctx.service.exchangeAuthorizationCode({
        grant_type: 'authorization_code',
        code: 'raw-code',
        redirect_uri: 'http://localhost:54321/callback',
        client_id: 'https://unknown.example/client.json',
        code_verifier: CODE_VERIFIER,
      })
    ).rejects.toBeInstanceOf(OAuthInvalidClientError)

    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  it('refuses a refresh for a client it has no row for, without fetching or storing it', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(null)

    await expect(
      ctx.service.exchangeRefreshToken({
        grant_type: 'refresh_token',
        refresh_token: 'raw-refresh',
        client_id: 'https://unknown.example/client.json',
      })
    ).rejects.toBeInstanceOf(OAuthInvalidClientError)

    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
    expect(ctx.clientRepository.create).not.toHaveBeenCalled()
  })

  // The cache is what keeps the consent page off the network on every visit.
  it('serves a fresh cached document to the authorization request without refetching', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(
      makeClient({ metadataFetchedAt: new Date() })
    )

    await ctx.service.resolveAuthorizationRequest(authorizeParams())

    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })
})
