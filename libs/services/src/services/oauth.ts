import { createHash, timingSafeEqual } from 'node:crypto'
import type {
  AccessControl,
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
  canonicalizeRedirectUri,
  isLoopbackRedirectHost,
  matchRedirectUri,
  normalizeOAuthUri,
  redirectUriMatches,
} from '../validation/oauth-uri.js'
import {
  authorizationCodeGrantSchema,
  authorizationRequestSchema,
  clientIdMetadataDocumentSchema,
  clientRegistrationSchema,
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
 * Every scope this server grants (Decision 14). `offline_access` is not a
 * permission on anything; it is what asks for a refresh token, which is why
 * the protected resources do not advertise it and the authorization server
 * does.
 */
const SUPPORTED_SCOPES = [
  'pins:read',
  'tags:read',
  'pins:write',
  'tags:write',
  'offline_access',
]

/**
 * What a request that names no scope is granted: read-only, always. A write
 * scope is granted because a client asked for it by name and the user
 * approved it on the consent screen, never because it defaulted in
 * (Decision 14).
 */
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

/** One application a user has given access to, as the profile page shows it. */
export interface OAuthGrant {
  /** The token to hand to `revokeGrant`. */
  tokenId: string
  clientId: string
  clientName: string | null
  /** Every scope any of the client's live tokens carries. */
  scopes: string[]
  /** Every audience the client holds a live token for. */
  resources: string[]
  expiresAt: Date
  createdAt: Date
}

/** Who a bearer token turns out to be, once it checks out. */
export interface VerifiedAccessToken {
  token: OAuthToken
  user: User
  clientId: string
  scopes: string[]
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
 * takes an Express `Response` (Decision 12). Everything here is testable
 * without HTTP and without a database, which is the test for whether a piece
 * is in the right layer (Decision 18).
 *
 * There is no `AccessControl` on the token endpoint's operations. A client
 * exchanging a code or a refresh token has no logged-in user to authorize
 * against; the code or the token is itself the proof, which is why those
 * methods verify possession rather than identity. The user-facing grant
 * operations do take one, as every user-scoped operation does.
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

    const client = await this.resolveClientForGrant(request.client_id)

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

    const client = await this.resolveClientForGrant(request.client_id)

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

  /**
   * Resolve a bearer token to the principal behind it, or to nothing.
   *
   * One call: the hash lookup, the expiry, revocation and audience checks,
   * and the account lookup. That is why the middleware over this needs no
   * repository (Decision 18).
   *
   * Every failure is the same `null`. A token for the wrong audience, an
   * expired one, a revoked one and one that never existed are indistinguishable
   * from outside on purpose, and a token whose user is gone reads as invalid
   * too: a distinct answer would confirm the token itself was good.
   */
  async verifyAccessToken(
    rawToken: string,
    expectedResource: string
  ): Promise<VerifiedAccessToken | null> {
    const token = await this.tokenRepository.findByTokenHash(
      hashToken(rawToken)
    )
    if (!token || token.kind !== 'access') {
      return null
    }

    if (token.revokedAt || token.expiresAt <= new Date()) {
      return null
    }

    if (!sameResource(token.resource, expectedResource)) {
      // RFC 8707 audience binding. The path component is significant, so an
      // `/mcp` token cannot drive `/api/v1` (Decision 16).
      return null
    }

    const user = await this.userRepository.findById(token.userId)
    if (!user) {
      return null
    }

    return { token, user, clientId: token.clientId, scopes: token.scopes }
  }

  /**
   * Register a client that posted its own metadata (RFC 7591).
   *
   * The fallback path, not the preferred one: DCR is deprecated in the current
   * spec and lets an anonymous caller create rows (Decision 13). Two things
   * bound the damage. The identifier is derived from the metadata rather than
   * generated, so re-registering the same client returns the same row instead
   * of a new one, and a row that never completes an authorization is swept.
   *
   * The derivation is what makes dedup work on a native client: the key drops
   * the port for loopback redirect URIs only, so Claude Code's fresh ephemeral
   * port each connection is the same client, while a different path or a
   * different host is not.
   */
  async registerClient(metadata: unknown): Promise<OAuthClient> {
    const parsed = clientRegistrationSchema.safeParse(metadata)
    if (!parsed.success) {
      throw validationErrorFromZod(parsed.error, {
        fallbackField: 'client_metadata',
      })
    }
    const request = parsed.data

    const authMethod = request.token_endpoint_auth_method ?? 'none'
    if (authMethod !== 'none') {
      // The metadata document advertises `none` and nothing else. Advertise
      // what is implemented; a secret this server never checks is worse than
      // no secret at all.
      throw new OAuthInvalidClientMetadataError(
        'This server registers public clients only (token_endpoint_auth_method must be none)'
      )
    }

    const grantTypes = request.grant_types ?? DEFAULT_GRANT_TYPES
    const unsupported = grantTypes.filter(
      grant => !DEFAULT_GRANT_TYPES.includes(grant)
    )
    if (unsupported.length > 0) {
      throw new OAuthInvalidClientMetadataError(
        `Unsupported grant type: ${unsupported.join(', ')}`
      )
    }

    const redirectUris = request.redirect_uris.map(uri =>
      requireUsableRedirectUri(uri)
    )

    const clientId = dcrClientId({
      clientName: request.client_name ?? null,
      redirectUris,
      grantTypes,
      authMethod,
    })

    const existing = await this.clientRepository.findByClientId(clientId)
    if (existing) {
      return existing
    }

    return this.clientRepository.create({
      clientId,
      clientName: request.client_name ?? null,
      redirectUris,
      grantTypes,
      tokenEndpointAuthMethod: authMethod,
      registrationType: 'dcr',
      metadataUrl: null,
      metadataFetchedAt: null,
    })
  }

  /**
   * Bring the clients an operator pre-registered into the table.
   *
   * Called once at boot from the composition root, so an organisation can
   * paste its own `client_id` when adding PinSquirrel as a custom connector
   * instead of relying on CIMD or dynamic registration. They are public
   * clients with PKCE like every other client here; nothing issues or checks a
   * secret, and the server metadata advertises no other auth method.
   *
   * Upsert only. An entry dropped from the config leaves its row alone rather
   * than deleting it, because deleting a client cascades to the authorization
   * codes and tokens that reference it - an operator editing a name should not
   * be able to sign every user of that connector out by fat-fingering a
   * different identifier.
   */
  async reconcileStaticClients(
    clients: {
      clientId: string
      clientName: string | null
      redirectUris: string[]
    }[]
  ): Promise<void> {
    for (const client of clients) {
      const redirectUris = client.redirectUris.map(uri =>
        requireUsableRedirectUri(uri)
      )

      const existing = await this.clientRepository.findByClientId(
        client.clientId
      )

      if (!existing) {
        await this.clientRepository.create({
          clientId: client.clientId,
          clientName: client.clientName,
          redirectUris,
          grantTypes: DEFAULT_GRANT_TYPES,
          tokenEndpointAuthMethod: 'none',
          registrationType: 'static',
          metadataUrl: null,
          metadataFetchedAt: null,
        })
        continue
      }

      if (
        existing.clientName === client.clientName &&
        sameUriList(existing.redirectUris, redirectUris)
      ) {
        // Nothing to say. Every boot would otherwise write the same row back.
        continue
      }

      await this.clientRepository.update(existing.id, {
        clientName: client.clientName,
        redirectUris,
      })
    }
  }

  /**
   * The applications a user has given access to.
   *
   * One entry per client rather than per token or per audience. An
   * authorization mints an access token and a refresh token, and the profile
   * page is showing the application, not the plumbing; and `revokeGrant` takes
   * every token the client holds whatever the audience, so a row per audience
   * would promise a granularity the Revoke button does not have. The row says
   * everything the client can reach instead. Takes an `AccessControl` because
   * this is a user-facing operation, as every user-scoped operation does.
   */
  async listGrants(ac: AccessControl, userId: string): Promise<OAuthGrant[]> {
    if (!ac.canCreateAs(userId)) {
      throw new OAuthAccessDeniedError(
        "Not authorized to list another user's grants"
      )
    }

    const tokens = await this.tokenRepository.findActiveByUserId(userId)

    const grouped = new Map<string, OAuthToken[]>()
    for (const token of tokens) {
      const group = grouped.get(token.clientId)
      if (group) group.push(token)
      else grouped.set(token.clientId, [token])
    }

    const names = new Map<string, string | null>()
    const grants: OAuthGrant[] = []

    for (const group of grouped.values()) {
      const newest = group.reduce((latest, token) =>
        token.createdAt > latest.createdAt ? token : latest
      )

      if (!names.has(newest.clientId)) {
        const client = await this.clientRepository.findByClientId(
          newest.clientId
        )
        names.set(newest.clientId, client?.clientName ?? null)
      }

      grants.push({
        tokenId: newest.id,
        clientId: newest.clientId,
        clientName: names.get(newest.clientId) ?? null,
        scopes: [...new Set(group.flatMap(token => token.scopes))],
        resources: [...new Set(group.map(token => token.resource))],
        expiresAt: newest.expiresAt,
        createdAt: newest.createdAt,
      })
    }

    return grants
  }

  /**
   * Take an application's access away.
   *
   * Revoking one token would leave the rest of the grant alive, so the access
   * token and the refresh token go together: a client whose refresh token
   * survived would simply mint another access token, and one whose access
   * token survived keeps working until it expires.
   */
  async revokeGrant(ac: AccessControl, tokenId: string): Promise<void> {
    const token = await this.tokenRepository.findById(tokenId)
    if (!token) {
      throw new OAuthInvalidGrantError('No such grant')
    }

    if (!ac.canDelete(token)) {
      throw new OAuthAccessDeniedError(
        "Not authorized to revoke another user's grant"
      )
    }

    await this.revokeGrantFamily(token.userId, token.clientId)
  }

  /**
   * Hand a token back (RFC 7009).
   *
   * Always succeeds, whatever was presented. An unknown token, an already dead
   * one and one belonging to a different client all answer the same way,
   * because a revocation endpoint that reported which was which would be a way
   * to find out whether a token exists.
   */
  async revokeToken(input: {
    token: string
    client_id?: string
    token_type_hint?: string
  }): Promise<void> {
    const token = await this.tokenRepository.findByTokenHash(
      hashToken(input.token)
    )
    if (!token) {
      return
    }

    if (input.client_id && token.clientId !== input.client_id) {
      return
    }

    if (token.kind === 'refresh') {
      // A refresh token stands for the whole grant; leaving its access tokens
      // alive would keep the client working for the rest of the hour.
      await this.revokeGrantFamily(token.userId, token.clientId)
      return
    }

    await this.tokenRepository.revoke(token.id)
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
   * at the resource server is the confused-deputy defense (Decision 15) and a
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
   * (Decision 15), there is no default to fall back to.
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
   * An HTTPS URL is a Client ID Metadata Document (Decision 13): it names a
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
   * The client behind a `client_id` on a token request.
   *
   * A row this server already has is good enough here, however old its cached
   * metadata is. What the token endpoint does with the client is compare its
   * identifier against the one on the code or the refresh token; the redirect
   * URI is checked against the code, and the audience against the grant.
   * Nothing reads the redirect URIs or the grant types off the client, so a
   * re-fetch could not change the answer.
   *
   * It could easily change the timing. Claude gives a token exchange 10
   * seconds and a refresh 30, and a CIMD fetch has a 10 second timeout of its
   * own, so a stale cache behind a slow or unreachable client host would spend
   * the entire budget waiting for a document whose contents do not matter. The
   * authorization request is where the document is validated and refreshed;
   * that page is not on the budget.
   */
  private async resolveClientForGrant(clientId: string): Promise<OAuthClient> {
    const known = await this.clientRepository.findByClientId(clientId)
    if (known) return known

    // No row at all. There is no grant to exchange either, but resolving
    // properly is what turns that into `invalid_client` rather than a
    // confusing `invalid_grant`.
    return this.resolveClient(clientId)
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

/**
 * Are these two the same resource identifier?
 *
 * Normalized on both sides, so a trailing slash or an upper-case host is not
 * an audience failure. Divergent normalization here looks like random
 * connection breakage from the outside.
 */
/**
 * A redirect URI a client may register.
 *
 * https anywhere, and plaintext only on loopback, where there is no network
 * to intercept and RFC 8252 expects it. A plaintext URI on a real host would
 * carry an authorization code across the internet in the clear.
 */
function requireUsableRedirectUri(uri: string): string {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    throw new OAuthInvalidClientMetadataError(`Unusable redirect_uri: ${uri}`)
  }

  if (url.protocol === 'https:') return uri
  if (url.protocol === 'http:' && isLoopbackRedirectHost(url.hostname)) {
    return uri
  }

  throw new OAuthInvalidClientMetadataError(
    `redirect_uri must be https, or http on loopback: ${uri}`
  )
}

/**
 * The identifier a dynamic registration gets, derived from what it registered.
 *
 * Derived rather than random so that re-registering the same client resolves
 * to the same row. The redirect URIs go in canonicalized, which is what drops
 * the port for loopback hosts only: Claude Code registering a fresh ephemeral
 * port on every connection is one client, and a different path or host is a
 * different one. There is no secret here to protect - a public client's
 * identifier is public by definition.
 */
function dcrClientId(metadata: {
  clientName: string | null
  redirectUris: string[]
  grantTypes: string[]
  authMethod: string
}): string {
  const key = JSON.stringify({
    clientName: metadata.clientName,
    redirectUris: metadata.redirectUris
      .map(uri => canonicalizeRedirectUri(uri))
      .sort(),
    grantTypes: [...metadata.grantTypes].sort(),
    authMethod: metadata.authMethod,
  })

  return `dcr_${hashToken(key)}`
}

function sameResource(one: string, other: string): boolean {
  try {
    return normalizeOAuthUri(one) === normalizeOAuthUri(other)
  } catch {
    return false
  }
}

function looksLikeUrl(clientId: string): boolean {
  return /^https?:\/\//i.test(clientId)
}

function isFresh(fetchedAt: Date | null): boolean {
  if (!fetchedAt) return false
  return Date.now() - fetchedAt.getTime() < CIMD_CACHE_TTL_MS
}

/** Are these the same redirect URIs, in the same order? */
function sameUriList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((uri, index) => uri === b[index])
}
