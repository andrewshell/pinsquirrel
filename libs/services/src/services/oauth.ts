import { createHash, timingSafeEqual } from 'node:crypto'
import type {
  AccessControl,
  HttpFetcher,
  OAuthAuthorizationCodeRepository,
  OAuthClient,
  OAuthClientRepository,
  OAuthTokenRepository,
  UserRepository,
} from '@pinsquirrel/domain'
import {
  OAuthAccessDeniedError,
  OAuthInvalidClientError,
  OAuthInvalidGrantError,
  OAuthInvalidClientMetadataError,
  OAuthInvalidRequestError,
  OAuthInvalidScopeError,
  OAuthInvalidTargetError,
  OAuthUnauthorizedClientError,
} from '@pinsquirrel/domain'
import { generateSecureToken, hashToken } from '../utils/crypto.js'
import {
  matchRedirectUri,
  normalizeOAuthUri,
  redirectUriMatches,
} from '../validation/oauth-uri.js'
import {
  authorizationCodeGrantSchema,
  authorizationRequestSchema,
  clientIdMetadataDocumentSchema,
  refreshTokenGrantSchema,
  type ClientIdMetadataDocument,
} from '../validation/oauth.js'
import { validateUrlForFetching } from '../validation/url.js'
import { validationErrorFromZod } from '../validation/zod-error.js'

/**
 * How long an authorization code is good for.
 *
 * The client redeems it the moment the browser lands on its redirect, so this
 * only has to cover that hop. OAuth 2.1 allows up to ten minutes; a code that
 * outlives its use is only a window for a replay.
 */
const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000

/**
 * How long an access token lives.
 *
 * Short enough that a leaked one stops working the same day, long enough that
 * a client is not refreshing on every other call. A client with
 * `offline_access` refreshes silently; one without it re-consents.
 */
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000

/**
 * How long a refresh token lives if it is never used. Each rotation issues a
 * fresh one, so an active connection keeps working indefinitely and an
 * abandoned one falls out on its own.
 */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * The prefix on every access token this server issues. Not for dispatch,
 * since there is nothing to dispatch between: it is so a leaked or logged
 * token is identifiable on sight.
 */
const ACCESS_TOKEN_PREFIX = 'pso_'

/** The scope that asks for a refresh token rather than for a permission. */
const OFFLINE_ACCESS_SCOPE = 'offline_access'

/**
 * Every scope this server grants (Decision 16). `offline_access` is not a
 * permission on anything; it is what asks for a refresh token, which is why
 * the protected resources do not advertise it and the authorization server
 * does.
 */
const SUPPORTED_SCOPES = ['pins:read', 'tags:read', 'offline_access']

/** What a request that names no scope is granted. */
const DEFAULT_SCOPES = ['pins:read', 'tags:read']

/** How long a fetched CIMD document is trusted before it is fetched again. */
const CIMD_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * The most a CIMD document may weigh. Real ones are a few hundred bytes; the
 * cap exists because the fetcher has none and the URL is caller-supplied.
 */
const MAX_CIMD_DOCUMENT_BYTES = 16 * 1024

/** What this server issues tokens for. */
export interface OAuthServiceConfig {
  /** The authorization server's identity, for the RFC 9207 `iss` parameter. */
  issuer: string
  /** Every resource identifier a token may be bound to (RFC 8707). */
  resources: string[]
}

/** What a token endpoint answers with, before it is put on the wire. */
export interface IssuedTokens {
  /** The raw access token, `pso_` prefixed. Returned once. */
  accessToken: string
  /** The raw refresh token, or null when `offline_access` was not granted. */
  refreshToken: string | null
  tokenType: 'Bearer'
  /** Access token lifetime in seconds, for `expires_in`. */
  expiresIn: number
  scopes: string[]
  /** The audience both tokens are bound to. */
  resource: string
}

/** An authorization request that passed every check but consent. */
export interface ResolvedAuthorizationRequest {
  client: OAuthClient
  /** Where the browser will be sent, ephemeral loopback port included. */
  redirectUri: string
  /** The registered URI that matched, which is what the consent screen names. */
  registeredRedirectUri: string
  scopes: string[]
  resource: string
  codeChallenge: string
  state?: string
}

/** What the consent screen's decision leaves the transport to redirect with. */
export type AuthorizationOutcome =
  | {
      status: 'approved'
      /** The raw code. Returned here once; only its hash is stored. */
      code: string
      redirectUri: string
      state?: string
      scopes: string[]
      expiresAt: Date
      /** RFC 9207, which the redirect carries on success and on failure. */
      issuer: string
    }
  | {
      status: 'denied'
      error: 'access_denied'
      errorDescription: string
      redirectUri: string
      state?: string
      issuer: string
    }

/**
 * The OAuth 2.1 authorization server.
 *
 * Shaped after the MCP SDK's `OAuthServerProvider` so the mental model
 * matches the ecosystem, but deliberately not implementing it: that interface
 * takes an Express `Response` (Decision 14). Everything here is testable
 * without HTTP and without a database, which is the test for whether a piece
 * is in the right layer (Decision 20).
 *
 * There is no `AccessControl` on the token endpoint's operations. A client
 * exchanging a code or a refresh token has no logged-in user to authorize
 * against; the code or the token is itself the proof, which is why those
 * methods verify possession rather than identity. The user-facing grant
 * operations do take one, exactly as `ApiKeyService.listApiKeys` does.
 */
export class OAuthService {
  constructor(
    private readonly clientRepository: OAuthClientRepository,
    private readonly codeRepository: OAuthAuthorizationCodeRepository,
    private readonly tokenRepository: OAuthTokenRepository,
    private readonly userRepository: UserRepository,
    private readonly httpFetcher: HttpFetcher,
    private readonly config: OAuthServiceConfig
  ) {}

  /**
   * Everything an authorization request needs before a consent screen can be
   * shown: the client it came from, the redirect URI it will be answered at,
   * and the scopes and audience the user is being asked to agree to.
   *
   * The order the checks run in is the order the failures have to be handled
   * in. A bad `client_id` or an unregistered `redirect_uri` is a page the user
   * sees, because there is nowhere trustworthy to redirect. Everything after
   * that is redirected back to the client as an RFC 6749 error, which is why
   * the redirect URI is established first.
   */
  async resolveAuthorizationRequest(
    params: unknown
  ): Promise<ResolvedAuthorizationRequest> {
    const parsed = authorizationRequestSchema.safeParse(params)
    if (!parsed.success) {
      throw validationErrorFromZod(parsed.error, {
        fallbackField: 'authorization_request',
      })
    }
    const request = parsed.data

    const client = await this.resolveClient(request.client_id)

    const redirectUri = matchRedirectUri(
      client.redirectUris,
      request.redirect_uri
    )
    if (!redirectUri) {
      throw new OAuthInvalidRequestError(
        'redirect_uri does not match a URI this client registered'
      )
    }

    if (!client.grantTypes.includes('authorization_code')) {
      throw new OAuthUnauthorizedClientError(
        'This client is not registered for the authorization code grant'
      )
    }

    const resource = this.requireKnownResource(request.resource)
    const scopes = grantedScopes(request.scope)

    return {
      client,
      // The URI the browser is actually sent to, which is the one the token
      // exchange has to repeat. For a loopback client that is the registered
      // URI plus the ephemeral port it happens to be listening on.
      redirectUri: request.redirect_uri,
      registeredRedirectUri: redirectUri,
      scopes,
      resource,
      codeChallenge: request.code_challenge,
      state: request.state,
    }
  }

  /**
   * Turn a consent decision into something to redirect with.
   *
   * Approval mints an authorization code; the raw value is returned here and
   * nowhere else, since only its hash is stored. Denial is an outcome rather
   * than an exception, because the client still has to be told, and telling it
   * means redirecting to a URI that has already been validated. An exception
   * would leave the transport holding an error with nowhere to send it.
   */
  async authorize(
    ac: AccessControl,
    input: { params: unknown; userId: string; approved: boolean }
  ): Promise<AuthorizationOutcome> {
    if (!ac.canCreateAs(input.userId)) {
      throw new OAuthAccessDeniedError(
        'Not authorized to grant access on behalf of another user'
      )
    }

    const resolved = await this.resolveAuthorizationRequest(input.params)

    if (!input.approved) {
      return {
        status: 'denied',
        error: 'access_denied',
        errorDescription: 'The user denied the authorization request',
        redirectUri: resolved.redirectUri,
        state: resolved.state,
        issuer: this.config.issuer,
      }
    }

    const code = generateSecureToken()
    const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS)

    await this.codeRepository.create({
      codeHash: hashToken(code),
      clientId: resolved.client.clientId,
      userId: input.userId,
      redirectUri: resolved.redirectUri,
      codeChallenge: resolved.codeChallenge,
      scopes: resolved.scopes,
      resource: resolved.resource,
      expiresAt,
    })

    if (!resolved.client.completedAt) {
      // What takes a registration out of the incomplete-DCR sweep. A client
      // that has authorized somebody is in use, whatever it registered as.
      await this.clientRepository.markCompleted(resolved.client.id, new Date())
    }

    return {
      status: 'approved',
      code,
      redirectUri: resolved.redirectUri,
      state: resolved.state,
      scopes: resolved.scopes,
      expiresAt,
      issuer: this.config.issuer,
    }
  }

  /**
   * Spend an authorization code and mint the tokens it stands for.
   *
   * The code is consumed before anything else is checked, because consuming it
   * is the single-use guarantee and a failed check must not leave a code alive
   * to try again with a different verifier.
   *
   * There is no `AccessControl` here: the caller is a client, not a user, and
   * the code plus the PKCE verifier is the proof. That is the same reason
   * `MaintenanceService` takes none.
   */
  async exchangeAuthorizationCode(params: unknown): Promise<IssuedTokens> {
    const parsed = authorizationCodeGrantSchema.safeParse(params)
    if (!parsed.success) {
      throw validationErrorFromZod(parsed.error, {
        fallbackField: 'token_request',
      })
    }
    const request = parsed.data

    const client = await this.resolveClient(request.client_id)

    const code = await this.codeRepository.consume(hashToken(request.code))
    if (!code) {
      // Unknown, expired, or already spent. One answer for all three: telling
      // them apart would say whether a code ever existed.
      throw new OAuthInvalidGrantError(
        'The authorization code is invalid, expired, or already used'
      )
    }

    if (code.clientId !== client.clientId) {
      throw new OAuthInvalidGrantError(
        'The authorization code was issued to another client'
      )
    }

    if (!redirectUriMatches(code.redirectUri, request.redirect_uri)) {
      throw new OAuthInvalidGrantError(
        'redirect_uri does not match the one the code was issued to'
      )
    }

    if (!pkceVerifies(request.code_verifier, code.codeChallenge)) {
      // A client that cannot prove it started the flow did not present a valid
      // grant, whoever is holding the code.
      throw new OAuthInvalidGrantError('The PKCE verifier does not match')
    }

    if (request.resource) {
      const requested = this.requireKnownResource(request.resource)
      if (requested !== code.resource) {
        throw new OAuthInvalidTargetError(
          'resource does not match the one the code was issued for'
        )
      }
    }

    return this.issueTokens({
      client,
      userId: code.userId,
      scopes: code.scopes,
      resource: code.resource,
    })
  }

  /**
   * Rotate a refresh token: retire the one presented, issue its successor.
   *
   * OAuth 2.1 requires rotation for public clients, and CIMD and DCR both
   * register Claude as one. The retirement is `markRotated`, which only
   * succeeds on a token that has not been rotated yet, so two refreshes racing
   * on the same token resolve to one winner rather than two live chains.
   *
   * A token presented after it was rotated means the chain leaked. There is no
   * way to tell a client replaying its own token from somebody else holding a
   * copy, so the whole grant dies and the user re-consents.
   */
  async exchangeRefreshToken(params: unknown): Promise<IssuedTokens> {
    const parsed = refreshTokenGrantSchema.safeParse(params)
    if (!parsed.success) {
      throw validationErrorFromZod(parsed.error, {
        fallbackField: 'token_request',
      })
    }
    const request = parsed.data

    const client = await this.resolveClient(request.client_id)

    const token = await this.tokenRepository.findByTokenHash(
      hashToken(request.refresh_token)
    )
    if (
      !token ||
      token.kind !== 'refresh' ||
      token.clientId !== client.clientId ||
      token.revokedAt ||
      token.expiresAt <= new Date()
    ) {
      throw new OAuthInvalidGrantError(
        'The refresh token is invalid, expired, or revoked'
      )
    }

    if (token.rotatedAt) {
      await this.revokeGrantFamily(token.userId, token.clientId)
      throw new OAuthInvalidGrantError(
        'That refresh token was already exchanged; the grant has been revoked'
      )
    }

    const scopes = request.scope
      ? narrowedScopes(request.scope, token.scopes)
      : token.scopes

    if (request.resource) {
      const requested = this.requireKnownResource(request.resource)
      if (requested !== token.resource) {
        throw new OAuthInvalidTargetError(
          'resource does not match the audience this grant was made for'
        )
      }
    }

    if (!(await this.tokenRepository.markRotated(token.id))) {
      // Lost the race with a concurrent refresh of the same token. The other
      // one is already issuing a successor, so this one is a replay.
      await this.revokeGrantFamily(token.userId, token.clientId)
      throw new OAuthInvalidGrantError(
        'That refresh token was already exchanged; the grant has been revoked'
      )
    }

    return this.issueTokens({
      client,
      userId: token.userId,
      scopes,
      resource: token.resource,
      rotatedFrom: token.id,
    })
  }

  /** Kill every live token a user holds for one client. */
  private async revokeGrantFamily(
    userId: string,
    clientId: string
  ): Promise<number> {
    return this.tokenRepository.revokeByUserAndClient(userId, clientId)
  }

  /**
   * Mint an access token, and a refresh token when one was granted.
   *
   * Both carry the audience the grant was made for, because the audience check
   * at the resource server is the confused-deputy defense (Decision 17) and a
   * refresh that could widen it would walk straight around it.
   */
  private async issueTokens(grant: {
    client: OAuthClient
    userId: string
    scopes: string[]
    resource: string
    rotatedFrom?: string
  }): Promise<IssuedTokens> {
    const accessToken = ACCESS_TOKEN_PREFIX + generateSecureToken()
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS)

    await this.tokenRepository.create({
      tokenHash: hashToken(accessToken),
      kind: 'access',
      clientId: grant.client.clientId,
      userId: grant.userId,
      scopes: grant.scopes,
      resource: grant.resource,
      expiresAt,
    })

    // `offline_access` is what asks for unattended refresh, and a client not
    // registered for the grant cannot use one.
    const refreshable =
      grant.scopes.includes(OFFLINE_ACCESS_SCOPE) &&
      grant.client.grantTypes.includes('refresh_token')

    let refreshToken: string | null = null
    if (refreshable) {
      refreshToken = generateSecureToken()
      await this.tokenRepository.create({
        tokenHash: hashToken(refreshToken),
        kind: 'refresh',
        clientId: grant.client.clientId,
        userId: grant.userId,
        scopes: grant.scopes,
        resource: grant.resource,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        rotatedFrom: grant.rotatedFrom ?? null,
      })
    }

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      scopes: grant.scopes,
      resource: grant.resource,
    }
  }

  /**
   * The configured resource a `resource` parameter names, in canonical form.
   *
   * Compared after normalization so a trailing slash or an upper-case host is
   * the same resource, and refused outright when it is not one of ours: with
   * two protected resources whose separation is the confused-deputy defense
   * (Decision 17), there is no default to fall back to.
   */
  private requireKnownResource(resource: string): string {
    let normalized: string
    try {
      normalized = normalizeOAuthUri(resource)
    } catch {
      throw new OAuthInvalidTargetError('resource is not an absolute URI')
    }

    const known = this.config.resources.find(
      candidate => normalizeOAuthUri(candidate) === normalized
    )
    if (!known) {
      throw new OAuthInvalidTargetError(
        'This server issues no tokens for that resource'
      )
    }
    return normalizeOAuthUri(known)
  }

  /**
   * The client behind a `client_id`, whichever way it registered.
   *
   * An HTTPS URL is a Client ID Metadata Document (Decision 15): it names a
   * document this server fetches, validates and caches. Anything else is a
   * `dcr` or `static` registration and is a row lookup.
   */
  async resolveClient(clientId: string): Promise<OAuthClient> {
    if (looksLikeUrl(clientId)) {
      return this.resolveClientIdMetadataDocument(clientId)
    }

    const client = await this.clientRepository.findByClientId(clientId)
    if (!client) {
      throw new OAuthInvalidClientError('Unknown client_id')
    }
    return client
  }

  /**
   * Fetch (or reuse) the metadata document a CIMD `client_id` names.
   *
   * The fetch is a server-side request to a caller-supplied URL, so it goes
   * through the same guard as every other outbound fetch:
   * `validateUrlForFetching` rejects the obviously bad strings before DNS, and
   * `NodeHttpFetcher` re-checks the address it actually connects to on every
   * hop. Three rules are CIMD's own: https only, a path (an origin names no
   * document), and a size cap, since the fetcher has none.
   */
  private async resolveClientIdMetadataDocument(
    clientId: string
  ): Promise<OAuthClient> {
    const url = this.validateMetadataUrl(clientId)

    const cached = await this.clientRepository.findByClientId(clientId)
    if (cached && isFresh(cached.metadataFetchedAt)) {
      return cached
    }

    const document = await this.fetchClientIdMetadataDocument(url, clientId)
    const fetchedAt = new Date()

    if (cached) {
      const updated = await this.clientRepository.update(cached.id, {
        clientName: document.client_name ?? null,
        redirectUris: document.redirect_uris,
        grantTypes: document.grant_types ?? DEFAULT_GRANT_TYPES,
        tokenEndpointAuthMethod: document.token_endpoint_auth_method ?? 'none',
        metadataUrl: clientId,
        metadataFetchedAt: fetchedAt,
      })
      return updated ?? cached
    }

    return this.clientRepository.create({
      clientId,
      clientName: document.client_name ?? null,
      redirectUris: document.redirect_uris,
      grantTypes: document.grant_types ?? DEFAULT_GRANT_TYPES,
      tokenEndpointAuthMethod: document.token_endpoint_auth_method ?? 'none',
      registrationType: 'cimd',
      metadataUrl: clientId,
      metadataFetchedAt: fetchedAt,
    })
  }

  private validateMetadataUrl(clientId: string): string {
    let url: URL
    try {
      url = new URL(clientId)
    } catch {
      throw new OAuthInvalidClientError('client_id is not a usable URL')
    }

    if (url.protocol !== 'https:') {
      throw new OAuthInvalidClientError(
        'A client_id URL must use https, so the document cannot be rewritten in transit'
      )
    }

    if (url.pathname === '' || url.pathname === '/') {
      throw new OAuthInvalidClientError(
        'A client_id URL must name a document, not an origin'
      )
    }

    try {
      // The string-level SSRF pre-check: literal private addresses,
      // `localhost`, `.local`. The connect-time check is the fetcher's.
      validateUrlForFetching(clientId)
    } catch {
      throw new OAuthInvalidClientError(
        'That client_id URL cannot be fetched from this server'
      )
    }

    return clientId
  }

  private async fetchClientIdMetadataDocument(
    url: string,
    clientId: string
  ): Promise<ClientIdMetadataDocument> {
    let body: string
    try {
      body = await this.httpFetcher.fetch(url, { redirect: 'error' })
    } catch {
      // Whatever went wrong out there, the client_id is unusable here. The
      // reason is not echoed back: it describes somebody else's server.
      throw new OAuthInvalidClientError(
        'The client metadata document could not be fetched'
      )
    }

    if (Buffer.byteLength(body, 'utf8') > MAX_CIMD_DOCUMENT_BYTES) {
      throw new OAuthInvalidClientMetadataError(
        'The client metadata document is too large'
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      throw new OAuthInvalidClientMetadataError(
        'The client metadata document is not JSON'
      )
    }

    const result = clientIdMetadataDocumentSchema.safeParse(parsed)
    if (!result.success) {
      throw new OAuthInvalidClientMetadataError(
        'The client metadata document is not valid client metadata'
      )
    }

    if (result.data.client_id !== clientId) {
      // The whole check CIMD rests on. Without it a client could present any
      // URL and inherit whatever is published there.
      throw new OAuthInvalidClientMetadataError(
        'The client metadata document names a different client_id'
      )
    }

    return result.data
  }
}

/** The grant types a client gets if its metadata does not say. */
const DEFAULT_GRANT_TYPES = ['authorization_code', 'refresh_token']

/**
 * The scopes a request is granted, or a refusal.
 *
 * A request that names no scope gets the read scopes rather than nothing: an
 * empty grant would mint a token that can do nothing, and the client has no
 * way to tell that from one that works. An unknown scope is refused rather
 * than dropped, so a client asking for something it will not get finds out
 * now instead of at the first call.
 */
/**
 * Does this verifier hash to the challenge the code was issued with?
 *
 * S256 only, which is all the server metadata advertises. Compared in
 * constant time: the challenge is not a secret, but the comparison is on the
 * path an attacker controls one side of, and there is no reason to leak how
 * much of it matched.
 */
function pkceVerifies(verifier: string, challenge: string): boolean {
  const computed = Buffer.from(
    createHash('sha256').update(verifier).digest('base64url')
  )
  const expected = Buffer.from(challenge)
  if (computed.length !== expected.length) return false
  return timingSafeEqual(computed, expected)
}

function grantedScopes(scope: string | undefined): string[] {
  const requested = (scope ?? '').split(/\s+/).filter(Boolean)
  if (requested.length === 0) {
    return [...DEFAULT_SCOPES]
  }

  const unknown = requested.filter(one => !SUPPORTED_SCOPES.includes(one))
  if (unknown.length > 0) {
    throw new OAuthInvalidScopeError(
      `Unknown scope: ${unknown.join(', ')}. This server grants ${SUPPORTED_SCOPES.join(', ')}`
    )
  }

  return [...new Set(requested)]
}

/**
 * The scopes a refresh may ask for: any subset of what was already granted.
 *
 * Asking for more is refused rather than trimmed, because a client that
 * believes it has a scope it does not will fail later, somewhere less
 * informative than here.
 */
function narrowedScopes(scope: string, granted: string[]): string[] {
  const requested = scope.split(/\s+/).filter(Boolean)
  const widened = requested.filter(one => !granted.includes(one))
  if (widened.length > 0) {
    throw new OAuthInvalidScopeError(
      `A refresh cannot widen a grant. Not granted: ${widened.join(', ')}`
    )
  }
  return requested.length > 0 ? [...new Set(requested)] : granted
}

function looksLikeUrl(clientId: string): boolean {
  return /^https?:\/\//i.test(clientId)
}

function isFresh(fetchedAt: Date | null): boolean {
  if (!fetchedAt) return false
  return Date.now() - fetchedAt.getTime() < CIMD_CACHE_TTL_MS
}
