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
  HttpFetcher,
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
        authorizeParams({ scope: 'pins:read pins:write' })
      )
    ).rejects.toBeInstanceOf(OAuthInvalidScopeError)
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
