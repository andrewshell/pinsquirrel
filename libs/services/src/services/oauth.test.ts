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
  OAuthAuthorizationCodeRepository,
  OAuthClient,
  OAuthClientRepository,
  OAuthTokenRepository,
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
  Role,
  UserStatus,
  ValidationError,
} from '@pinsquirrel/domain'
import { createMockUserRepository } from '../test-utils.js'
import { OAuthService } from './oauth.js'

const MCP_RESOURCE = 'https://pinsquirrel.com/mcp'
const API_RESOURCE = 'https://pinsquirrel.com/api/v1'

const CIMD_URL = 'https://claude.ai/oauth/claude-code-client-metadata'

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
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeToken(
  data: CreateOAuthTokenData,
  overrides: Partial<OAuthToken> = {}
): OAuthToken {
  return {
    id: `token-${data.kind}`,
    revokedAt: null,
    rotatedAt: null,
    rotatedFrom: data.rotatedFrom ?? null,
    createdAt: new Date(),
    ...data,
    ...overrides,
  }
}

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

  const codeRepository = {
    findById: vi.fn(),
    findByCodeHash: vi.fn(),
    create: vi.fn(),
    consume: vi.fn(),
    delete: vi.fn(),
    deleteExpiredCodes: vi.fn(),
  } as unknown as OAuthAuthorizationCodeRepository

  const tokenRepository = {
    findById: vi.fn(),
    findByTokenHash: vi.fn(),
    findActiveByUserId: vi.fn(),
    findByRotatedFrom: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    revokeByUserAndClient: vi.fn(),
    markRotated: vi.fn(),
    deleteExpiredTokens: vi.fn(),
  } as unknown as OAuthTokenRepository

  const userRepository: UserRepository = createMockUserRepository()

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
    vi.mocked(ctx.fetcher.fetch).mockResolvedValue(
      JSON.stringify({ ...cimdDocument, padding: 'x'.repeat(20000) })
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
  it('rejects a redirect URI the client never registered', async () => {
    await expect(
      ctx.service.resolveAuthorizationRequest(
        authorizeParams({ redirect_uri: 'http://localhost:54321/evil' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidRequestError)
  })

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
    vi.mocked(ctx.codeRepository.create).mockImplementation(data =>
      Promise.resolve({
        id: 'code-1',
        consumedAt: null,
        createdAt: new Date(),
        ...data,
      })
    )
  })

  it('issues a code to the approved redirect URI and returns it once', async () => {
    const outcome = await ctx.service.authorize(ac, {
      params: authorizeParams(),
      userId: user.id,
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
      })
    )
    const created = vi.mocked(ctx.codeRepository.create).mock.calls[0][0]
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  // `completed_at` is what keeps a registration out of the incomplete-DCR
  // sweep, and an authorization is what completes it.
  it('marks the client as having completed an authorization', async () => {
    await ctx.service.authorize(ac, {
      params: authorizeParams(),
      userId: user.id,
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

  it('refuses to issue a code on behalf of another user', async () => {
    await expect(
      ctx.service.authorize(new AccessControl(otherUser), {
        params: authorizeParams(),
        userId: user.id,
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

  beforeEach(() => {
    ctx = setup()
    vi.mocked(ctx.codeRepository.consume).mockResolvedValue(makeCode())
    vi.mocked(ctx.tokenRepository.create).mockImplementation(data =>
      Promise.resolve(makeToken(data))
    )
  })

  it('exchanges a code for an access token bound to the requested resource', async () => {
    const issued = await ctx.service.exchangeAuthorizationCode(tokenParams())

    expect(ctx.codeRepository.consume).toHaveBeenCalledWith('hashed_raw-code')
    expect(issued.tokenType).toBe('Bearer')
    // Identifiable on sight if it is ever leaked or logged.
    expect(issued.accessToken.startsWith('pso_')).toBe(true)
    expect(issued.scopes).toEqual(['pins:read', 'tags:read'])
    expect(issued.resource).toBe(MCP_RESOURCE)
    expect(issued.expiresIn).toBeGreaterThan(0)

    expect(ctx.tokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'access',
        tokenHash: `hashed_${issued.accessToken}`,
        clientId: CIMD_URL,
        userId: user.id,
        scopes: ['pins:read', 'tags:read'],
        resource: MCP_RESOURCE,
      })
    )
  })

  it('issues no refresh token when offline_access was not granted', async () => {
    const issued = await ctx.service.exchangeAuthorizationCode(tokenParams())

    expect(issued.refreshToken).toBeNull()
    expect(ctx.tokenRepository.create).toHaveBeenCalledOnce()
  })

  it('issues a refresh token bound to the same resource when offline_access was granted', async () => {
    vi.mocked(ctx.codeRepository.consume).mockResolvedValue(
      makeCode({ scopes: ['pins:read', 'offline_access'] })
    )

    const issued = await ctx.service.exchangeAuthorizationCode(tokenParams())

    expect(issued.refreshToken).toBeTruthy()
    expect(ctx.tokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'refresh',
        tokenHash: `hashed_${issued.refreshToken ?? ''}`,
        resource: MCP_RESOURCE,
      })
    )
  })

  // Single use is the repository's guarantee; a spent, expired or unknown code
  // all arrive here the same way and all mean the same thing to the client.
  it('refuses a code that was already spent, expired or never existed', async () => {
    vi.mocked(ctx.codeRepository.consume).mockResolvedValue(null)

    await expect(
      ctx.service.exchangeAuthorizationCode(tokenParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
    expect(ctx.tokenRepository.create).not.toHaveBeenCalled()
  })

  it('refuses a verifier that does not hash to the stored challenge', async () => {
    await expect(
      ctx.service.exchangeAuthorizationCode(
        tokenParams({
          code_verifier: 'V-a-s-t-l-y-different-but-still-a-valid-PKCE-value',
        })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
    expect(ctx.tokenRepository.create).not.toHaveBeenCalled()
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
  })

  it('refuses a redirect URI that is not the one the code was issued to', async () => {
    await expect(
      ctx.service.exchangeAuthorizationCode(
        tokenParams({ redirect_uri: 'http://localhost:54321/elsewhere' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  // RFC 8707: a repeated `resource` has to be the one the code was bound to,
  // or the exchange would be a way to swap audiences after consent.
  it('refuses a resource other than the one consent was given for', async () => {
    await expect(
      ctx.service.exchangeAuthorizationCode(
        tokenParams({ resource: API_RESOURCE })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidTargetError)
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

  function refreshParams(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      grant_type: 'refresh_token',
      refresh_token: 'raw-refresh',
      client_id: CIMD_URL,
      ...overrides,
    }
  }

  function storedRefresh(overrides: Partial<OAuthToken> = {}): OAuthToken {
    return makeToken(
      {
        tokenHash: 'hashed_raw-refresh',
        kind: 'refresh',
        clientId: CIMD_URL,
        userId: user.id,
        scopes: refreshScopes,
        resource: MCP_RESOURCE,
        expiresAt: new Date(Date.now() + 60_000),
      },
      { id: 'refresh-1', ...overrides }
    )
  }

  beforeEach(() => {
    ctx = setup()
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      storedRefresh()
    )
    vi.mocked(ctx.tokenRepository.markRotated).mockResolvedValue(true)
    vi.mocked(ctx.tokenRepository.revokeByUserAndClient).mockResolvedValue(2)
    vi.mocked(ctx.tokenRepository.create).mockImplementation(data =>
      Promise.resolve(makeToken(data))
    )
  })

  // OAuth 2.1 requires rotation for public clients, and both CIMD and DCR
  // register Claude as one.
  it('issues a new refresh token and retires the one presented', async () => {
    const issued = await ctx.service.exchangeRefreshToken(refreshParams())

    expect(issued.refreshToken).toBeTruthy()
    expect(issued.refreshToken).not.toBe('raw-refresh')
    expect(ctx.tokenRepository.markRotated).toHaveBeenCalledWith('refresh-1')
    expect(ctx.tokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'refresh',
        rotatedFrom: 'refresh-1',
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

  // A token presented after it was rotated means the chain leaked: either the
  // client replayed it or somebody else has it, and there is no way to tell
  // which. Killing the family is the only safe answer.
  it('kills the whole grant when a rotated token is presented again', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      storedRefresh({ rotatedAt: new Date() })
    )

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)

    expect(ctx.tokenRepository.revokeByUserAndClient).toHaveBeenCalledWith(
      user.id,
      CIMD_URL
    )
    expect(ctx.tokenRepository.create).not.toHaveBeenCalled()
  })

  // Two refreshes racing on the same token: the marking is conditional, so
  // exactly one wins and the loser is a replay like any other.
  it('treats losing the rotation race as a replay', async () => {
    vi.mocked(ctx.tokenRepository.markRotated).mockResolvedValue(false)

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
    expect(ctx.tokenRepository.revokeByUserAndClient).toHaveBeenCalled()
  })

  it('refuses a token the user revoked', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      storedRefresh({ revokedAt: new Date() })
    )

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  it('refuses an expired token', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      storedRefresh({ expiresAt: new Date(Date.now() - 1000) })
    )

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  it('refuses an access token presented as a refresh token', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      storedRefresh({ kind: 'access' })
    )

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
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
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(null)

    await expect(
      ctx.service.exchangeRefreshToken(refreshParams())
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError)
  })

  it('lets a client ask for less than it already has', async () => {
    const issued = await ctx.service.exchangeRefreshToken(
      refreshParams({ scope: 'pins:read' })
    )

    expect(issued.scopes).toEqual(['pins:read'])
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

  it('rejects a malformed registration as a validation failure', async () => {
    await expect(
      ctx.service.registerClient({ redirect_uris: [] })
    ).rejects.toBeInstanceOf(ValidationError)
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
  it('revokes every token the grant covers', async () => {
    vi.mocked(ctx.tokenRepository.findById).mockResolvedValue(
      grantToken({ id: 'access-1' })
    )
    vi.mocked(ctx.tokenRepository.revokeByUserAndClient).mockResolvedValue(2)

    await ctx.service.revokeGrant(ac, 'access-1')

    expect(ctx.tokenRepository.revokeByUserAndClient).toHaveBeenCalledWith(
      user.id,
      CIMD_URL
    )
  })

  it("refuses to revoke another user's grant", async () => {
    vi.mocked(ctx.tokenRepository.findById).mockResolvedValue(
      grantToken({ id: 'access-1', userId: otherUser.id })
    )

    await expect(
      ctx.service.revokeGrant(ac, 'access-1')
    ).rejects.toBeInstanceOf(OAuthAccessDeniedError)
    expect(ctx.tokenRepository.revokeByUserAndClient).not.toHaveBeenCalled()
  })

  it('refuses to revoke a grant that does not exist', async () => {
    vi.mocked(ctx.tokenRepository.findById).mockResolvedValue(null)

    await expect(ctx.service.revokeGrant(ac, 'nope')).rejects.toBeInstanceOf(
      OAuthInvalidGrantError
    )
  })
})

describe('OAuthService.revokeToken', () => {
  let ctx: ReturnType<typeof setup>

  function stored(overrides: Partial<OAuthToken> = {}): OAuthToken {
    return makeToken(
      {
        tokenHash: 'hashed_raw',
        kind: 'access',
        clientId: CIMD_URL,
        userId: user.id,
        scopes: ['pins:read'],
        resource: MCP_RESOURCE,
        expiresAt: new Date(Date.now() + 60_000),
      },
      { id: 'access-1', ...overrides }
    )
  }

  beforeEach(() => {
    ctx = setup()
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(stored())
    vi.mocked(ctx.tokenRepository.revoke).mockResolvedValue(true)
    vi.mocked(ctx.tokenRepository.revokeByUserAndClient).mockResolvedValue(2)
  })

  it('revokes the access token a client hands back', async () => {
    await ctx.service.revokeToken({ token: 'raw', client_id: CIMD_URL })

    expect(ctx.tokenRepository.revoke).toHaveBeenCalledWith('access-1')
  })

  // RFC 7009: revoking a refresh token takes the access tokens with it, or
  // the client keeps working for the rest of the hour.
  it('takes the whole grant when the token handed back is a refresh token', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      stored({ id: 'refresh-1', kind: 'refresh' })
    )

    await ctx.service.revokeToken({ token: 'raw', client_id: CIMD_URL })

    expect(ctx.tokenRepository.revokeByUserAndClient).toHaveBeenCalledWith(
      user.id,
      CIMD_URL
    )
  })

  // RFC 7009 4.1.1: an unknown token is a success, so revocation cannot be
  // used to find out which tokens exist.
  it('says nothing about a token it does not know', async () => {
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(null)

    await expect(
      ctx.service.revokeToken({ token: 'raw' })
    ).resolves.toBeUndefined()
    expect(ctx.tokenRepository.revoke).not.toHaveBeenCalled()
  })

  it('leaves a token that belongs to another client alone, and still says nothing', async () => {
    await expect(
      ctx.service.revokeToken({ token: 'raw', client_id: 'dcr_someone_else' })
    ).resolves.toBeUndefined()
    expect(ctx.tokenRepository.revoke).not.toHaveBeenCalled()
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
    vi.mocked(ctx.codeRepository.consume).mockResolvedValue(makeCode())
    vi.mocked(ctx.tokenRepository.create).mockImplementation(data =>
      Promise.resolve(makeToken(data))
    )
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
    vi.mocked(ctx.tokenRepository.findByTokenHash).mockResolvedValue(
      makeToken({
        kind: 'refresh',
        tokenHash: 'hashed_raw-refresh',
        clientId: CIMD_URL,
        userId: user.id,
        scopes: ['pins:read', 'offline_access'],
        resource: MCP_RESOURCE,
        expiresAt: new Date(Date.now() + 60_000),
      })
    )
    vi.mocked(ctx.tokenRepository.markRotated).mockResolvedValue(true)

    await ctx.service.exchangeRefreshToken({
      grant_type: 'refresh_token',
      refresh_token: 'raw-refresh',
      client_id: CIMD_URL,
    })

    expect(ctx.fetcher.fetch).not.toHaveBeenCalled()
  })

  // The authorization request is where the document is validated, so a client
  // this server has never seen still has to be fetched there.
  it('still fetches the document for a client it has no row for', async () => {
    vi.mocked(ctx.clientRepository.findByClientId).mockResolvedValue(null)

    await expect(
      ctx.service.exchangeAuthorizationCode({
        grant_type: 'authorization_code',
        code: 'raw-code',
        redirect_uri: 'http://localhost:54321/callback',
        client_id: CIMD_URL,
        code_verifier: CODE_VERIFIER,
      })
    ).resolves.toBeDefined()

    expect(ctx.fetcher.fetch).toHaveBeenCalled()
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
