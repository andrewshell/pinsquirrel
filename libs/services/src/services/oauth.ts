import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import type {
  AccessControl,
  AuthorizationCode,
  HttpFetcher,
  IssuedTokenData,
  OAuthToken,
  User,
  OAuthAuthorizationCodeRepository,
  OAuthClient,
  OAuthClientRepository,
  OAuthTokenRepository,
  UserRepository,
} from '@pinsquirrel/domain'
import {
  isAdmitted,
  OAuthAccessDeniedError,
  OAuthError,
  OAuthInvalidClientError,
  OAuthInvalidGrantError,
  OAuthInvalidClientMetadataError,
  OAuthInvalidRequestError,
  OAuthInvalidScopeError,
  OAuthInvalidTargetError,
  OAuthUnauthorizedClientError,
  ResponseTooLargeError,
  ValidationError,
} from '@pinsquirrel/domain'
import { generateSecureToken, hashToken } from '../utils/crypto.js'
import {
  redirectUriDedupKey,
  normalizeOAuthUri,
  redirectUriMatches,
} from '../validation/oauth-uri.js'
import {
  authorizationCodeGrantSchema,
  authorizationRedirectSchema,
  authorizationRequestSchema,
  clientIdMetadataDocumentSchema,
  clientRegistrationSchema,
  isUsableRedirectUri,
  MAX_CLIENT_ID_LENGTH,
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

export const REFRESH_ROTATION_GRACE_MS = 30 * 1000

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
  clientId: string
  clientName: string | null
  /** Every scope any of the client's live tokens carries. */
  scopes: string[]
  /** Every audience the client holds a live token for. */
  resources: string[]
  /** When the longest-lived of the client's tokens runs out. */
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
  status: 'resolved'
  client: OAuthClient
  /** Where the browser will be sent, ephemeral loopback port included. */
  redirectUri: string
  scopes: string[]
  resource: string
  codeChallenge: string
  state?: string
}

/**
 * An RFC 6749 4.1.2.1 error, to be sent to a redirect URI that has already
 * been shown to be the client's.
 */
export interface AuthorizationErrorRedirect {
  status: 'error'
  error: string
  errorDescription: string
  redirectUri: string
  state?: string
  /** RFC 9207, which the redirect carries on success and on failure. */
  issuer: string
}

export type AuthorizationRequestResolution =
  ResolvedAuthorizationRequest | AuthorizationErrorRedirect

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
      issuer: string
    }
  | AuthorizationErrorRedirect

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
   * in. A bad `client_id`, `redirect_uri` or `state`, or an unregistered
   * `redirect_uri`, is thrown, for a page the user sees, because there is
   * nowhere trustworthy to redirect. Everything after that comes back as an
   * error outcome to redirect to the client (RFC 6749 4.1.2.1), which is why
   * the redirect URI is established first.
   */
  async resolveAuthorizationRequest(
    params: unknown
  ): Promise<AuthorizationRequestResolution> {
    const target = authorizationRedirectSchema.safeParse(params)
    if (!target.success) {
      throw validationErrorFromZod(target.error, {
        fallbackField: 'authorization_request',
      })
    }
    const {
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    } = target.data

    const client = await this.resolveClient(clientId)

    if (
      !client.redirectUris.some(uri => redirectUriMatches(uri, redirectUri))
    ) {
      throw new OAuthInvalidRequestError(
        'redirect_uri does not match a URI this client registered'
      )
    }

    try {
      return this.checkAuthorizationRequest(client, params)
    } catch (error) {
      if (error instanceof OAuthError) {
        return this.errorRedirect(
          { redirectUri, state },
          error.code,
          error.message
        )
      }
      if (error instanceof ValidationError) {
        return this.errorRedirect(
          { redirectUri, state },
          'invalid_request',
          `Invalid parameter: ${Object.keys(error.fields).join(', ')}`
        )
      }
      throw error
    }
  }

  private checkAuthorizationRequest(
    client: OAuthClient,
    params: unknown
  ): ResolvedAuthorizationRequest {
    const parsed = authorizationRequestSchema.safeParse(params)
    if (!parsed.success) {
      throw validationErrorFromZod(parsed.error, {
        fallbackField: 'authorization_request',
      })
    }
    const request = parsed.data

    if (!client.grantTypes.includes('authorization_code')) {
      throw new OAuthUnauthorizedClientError(
        'This client is not registered for the authorization code grant'
      )
    }

    const resource = this.requireKnownResource(request.resource)
    const scopes = grantedScopes(request.scope)

    return {
      status: 'resolved',
      client,
      // The URI the browser is actually sent to, which is the one the token
      // exchange has to repeat. For a loopback client that is the registered
      // URI plus the ephemeral port it happens to be listening on.
      redirectUri: request.redirect_uri,
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
    input: {
      params: unknown
      userId: string
      /** The session the user approved in; the code is written only while it exists. */
      sessionId: string
      approved: boolean
    }
  ): Promise<AuthorizationOutcome> {
    if (!ac.canCreateAs(input.userId)) {
      throw new OAuthAccessDeniedError(
        'Not authorized to grant access on behalf of another user'
      )
    }
    if (!ac.user || !isAdmitted(ac.user)) {
      throw new OAuthAccessDeniedError('This account cannot grant access')
    }

    const resolved = await this.resolveAuthorizationRequest(input.params)
    if (resolved.status === 'error') {
      return resolved
    }

    if (!input.approved) {
      return this.errorRedirect(
        resolved,
        'access_denied',
        'The user denied the authorization request'
      )
    }

    const code = generateSecureToken()
    const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS)

    const created = await this.codeRepository.create(
      {
        codeHash: hashToken(code),
        clientId: resolved.client.clientId,
        userId: input.userId,
        redirectUri: resolved.redirectUri,
        codeChallenge: resolved.codeChallenge,
        scopes: resolved.scopes,
        resource: resolved.resource,
        grantId: randomUUID(),
        expiresAt,
      },
      input.sessionId
    )
    if (!created) {
      return this.errorRedirect(
        resolved,
        'access_denied',
        'The session that approved this request has ended'
      )
    }

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
   * The code is read and checked first. One that was already spent takes the
   * tokens it produced down with it. A code that passes is spent and its
   * tokens are written in one step (`exchange`), so a failure in between
   * leaves the client a code that still works. A code that fails a check is
   * spent anyway, because a failed check must not leave a code alive to try
   * again with a different verifier. A check that could not be made, because
   * the database was unreachable, spends nothing.
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

    const client = await this.requireStoredClient(request.client_id)

    const code = await this.codeRepository.findByCodeHash(
      hashToken(request.code)
    )
    if (code?.consumedAt) {
      return this.refuseSpentCode(code)
    }
    if (!code || code.expiresAt <= new Date()) {
      throw invalidCode()
    }

    try {
      await this.requireCodeMatches(code, client, request)
    } catch (error) {
      if (error instanceof OAuthError) {
        await this.codeRepository.consume(code.codeHash)
      }
      throw error
    }

    // `offline_access` is what asks for unattended refresh, and a client not
    // registered for the grant cannot use one.
    const refreshable =
      code.scopes.includes(OFFLINE_ACCESS_SCOPE) &&
      client.grantTypes.includes('refresh_token')

    const { rows, issued } = mintTokens({
      clientId: client.clientId,
      userId: code.userId,
      accessScopes: code.scopes,
      refreshScopes: refreshable ? code.scopes : null,
      resource: code.resource,
      grantId: code.grantId ?? randomUUID(),
    })

    const outcome = await this.codeRepository.exchange(code.id, rows)
    if (outcome === 'spent') {
      return this.refuseSpentCode(code)
    }
    if (outcome === 'gone') {
      throw invalidCode()
    }
    return issued
  }

  /**
   * Answer a code that was already exchanged.
   *
   * A code presented twice has been seen by two parties, and nothing says
   * which of them holds the tokens it produced, so those tokens are revoked
   * (RFC 6749 4.1.2). The answer is the same as for any other bad code.
   */
  private async refuseSpentCode(code: AuthorizationCode): Promise<never> {
    await this.revokeGrantOf(code)
    throw invalidCode()
  }

  private async requireCodeMatches(
    code: AuthorizationCode,
    client: OAuthClient,
    request: { redirect_uri: string; code_verifier: string; resource?: string }
  ): Promise<void> {
    if (code.clientId !== client.clientId) {
      throw new OAuthInvalidGrantError(
        'The authorization code was issued to another client'
      )
    }

    if (request.redirect_uri !== code.redirectUri) {
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

    await this.revokeGrantUnlessAdmitted(code.userId, client.clientId)
  }

  /**
   * Rotate a refresh token: retire the one presented, issue its successor.
   *
   * OAuth 2.1 requires rotation for public clients, and CIMD and DCR both
   * register Claude as one. The retirement and the successors are one write
   * (`rotate`), which only succeeds on a token that has not been rotated or
   * revoked. So of two refreshes racing on the same token one wins and keeps
   * its tokens, the other is refused, and a failure partway leaves the client
   * a token that still works. `refuseRotatedToken` covers a token that comes
   * back after it was rotated.
   */
  async exchangeRefreshToken(params: unknown): Promise<IssuedTokens> {
    const parsed = refreshTokenGrantSchema.safeParse(params)
    if (!parsed.success) {
      throw validationErrorFromZod(parsed.error, {
        fallbackField: 'token_request',
      })
    }
    const request = parsed.data

    const client = await this.requireStoredClient(request.client_id)

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
      return this.refuseRotatedToken(token, token.rotatedAt)
    }

    if (!client.grantTypes.includes('refresh_token')) {
      throw new OAuthUnauthorizedClientError(
        'This client is not registered for the refresh_token grant'
      )
    }

    await this.revokeGrantUnlessAdmitted(token.userId, client.clientId)

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

    // A narrower `scope` narrows this access token only. The successor keeps
    // the grant's scopes (RFC 6749 section 6), and there always is one: a
    // refresh never retires a token without replacing it.
    const { rows, issued } = mintTokens({
      clientId: client.clientId,
      userId: token.userId,
      accessScopes: scopes,
      refreshScopes: token.scopes,
      resource: token.resource,
      grantId: token.grantId ?? randomUUID(),
      rotatedFrom: token.id,
    })

    if (!(await this.tokenRepository.rotate(token.id, rows))) {
      const current = await this.tokenRepository.findById(token.id)
      if (current?.rotatedAt && !current.revokedAt) {
        return this.refuseRotatedToken(current, current.rotatedAt)
      }
      throw new OAuthInvalidGrantError(
        'The grant was revoked during the refresh'
      )
    }

    return issued
  }

  private async refuseRotatedToken(
    token: OAuthToken,
    rotatedAt: Date
  ): Promise<never> {
    if (Date.now() - rotatedAt.getTime() < REFRESH_ROTATION_GRACE_MS) {
      throw new OAuthInvalidGrantError(
        'That refresh token was already exchanged'
      )
    }

    await this.revokeGrantOf(token)
    throw new OAuthInvalidGrantError(
      'That refresh token was already exchanged; the grant has been revoked'
    )
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
   * too: a distinct answer would confirm the token itself was good. So does
   * one whose user is no longer admitted.
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
    if (!user || !isAdmitted(user)) {
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

    const { redirectUris, grantTypes, authMethod } = requireClientRules(request)

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
   *
   * Each entry is reconciled on its own, so one bad entry does not keep the
   * rest out of the table. The failures come back for the caller to log.
   */
  async reconcileStaticClients(
    clients: {
      clientId: string
      clientName: string | null
      redirectUris: string[]
    }[]
  ): Promise<{ clientId: string; error: unknown }[]> {
    const failures: { clientId: string; error: unknown }[] = []
    for (const client of clients) {
      try {
        await this.reconcileStaticClient(client)
      } catch (error) {
        failures.push({ clientId: client.clientId, error })
      }
    }
    return failures
  }

  private async reconcileStaticClient(client: {
    clientId: string
    clientName: string | null
    redirectUris: string[]
  }): Promise<void> {
    const { redirectUris, grantTypes, authMethod } = requireClientRules({
      redirect_uris: client.redirectUris,
    })

    const existing = await this.clientRepository.findByClientId(client.clientId)

    if (!existing) {
      await this.clientRepository.create({
        clientId: client.clientId,
        clientName: client.clientName,
        redirectUris,
        grantTypes,
        tokenEndpointAuthMethod: authMethod,
        registrationType: 'static',
        metadataUrl: null,
        metadataFetchedAt: null,
      })
      return
    }

    if (
      existing.clientName === client.clientName &&
      sameUriList(existing.redirectUris, redirectUris)
    ) {
      // Nothing to say. Every boot would otherwise write the same row back.
      return
    }

    await this.clientRepository.update(existing.id, {
      clientName: client.clientName,
      redirectUris,
    })
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
        clientId: newest.clientId,
        clientName: names.get(newest.clientId) ?? null,
        scopes: [...new Set(group.flatMap(token => token.scopes))],
        resources: [...new Set(group.map(token => token.resource))],
        expiresAt: new Date(
          Math.max(...group.map(token => token.expiresAt.getTime()))
        ),
        createdAt: newest.createdAt,
      })
    }

    return grants
  }

  /**
   * Take an application's access away, on every device it was approved on.
   *
   * The profile page lists applications, so its Revoke takes every grant the
   * user has given that client. Revoking one token would leave the rest
   * alive: a client whose refresh token survived would simply mint another
   * access token, and one whose access token survived keeps working until it
   * expires.
   */
  async revokeGrant(
    ac: AccessControl,
    userId: string,
    clientId: string
  ): Promise<void> {
    if (!ac.canDelete({ userId })) {
      throw new OAuthAccessDeniedError(
        "Not authorized to revoke another user's grant"
      )
    }

    if (
      (await this.tokenRepository.revokeByUserAndClient(userId, clientId)) === 0
    ) {
      throw new OAuthInvalidGrantError('No such grant')
    }
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
      // A refresh token stands for its grant (RFC 7009 2.1); leaving the
      // grant's access tokens alive would keep the client working for the
      // rest of the hour.
      await this.revokeGrantOf(token)
      return
    }

    await this.tokenRepository.revoke(token.id)
  }

  private async revokeGrantUnlessAdmitted(
    userId: string,
    clientId: string
  ): Promise<void> {
    const user = await this.userRepository.findById(userId)
    if (!user || !isAdmitted(user)) {
      await this.tokenRepository.revokeByUserAndClient(userId, clientId)
      throw new OAuthInvalidGrantError(
        'The account behind this grant is not active'
      )
    }
  }

  private async revokeGrantOf(
    holder: Pick<OAuthToken, 'userId' | 'clientId' | 'grantId'>
  ): Promise<void> {
    if (holder.grantId) {
      await this.tokenRepository.revokeByGrant(holder.userId, holder.grantId)
    } else {
      await this.tokenRepository.revokeByUserAndClient(
        holder.userId,
        holder.clientId
      )
    }
  }

  private errorRedirect(
    target: { redirectUri: string; state?: string },
    error: string,
    errorDescription: string
  ): AuthorizationErrorRedirect {
    return {
      status: 'error',
      error,
      errorDescription,
      redirectUri: target.redirectUri,
      state: target.state,
      issuer: this.config.issuer,
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
    if (clientId.length > MAX_CLIENT_ID_LENGTH) {
      throw new OAuthInvalidClientError('client_id is too long')
    }

    if (looksLikeUrl(clientId)) {
      return this.resolveClientIdMetadataDocument(clientId)
    }

    const client = await this.findClient(clientId)
    if (!client) {
      throw new OAuthInvalidClientError('Unknown client_id')
    }
    return client
  }

  private async findClient(clientId: string): Promise<OAuthClient | null> {
    const client = await this.clientRepository.findByClientId(clientId)
    return client?.clientId === clientId ? client : null
  }

  /**
   * A stale row is not re-fetched here: Claude gives a token exchange 10
   * seconds and a refresh 30, and a CIMD fetch has a 10 second timeout of its
   * own. The authorization request is where the document is refreshed.
   */
  private async requireStoredClient(clientId: string): Promise<OAuthClient> {
    const known = await this.findClient(clientId)
    if (!known) {
      throw new OAuthInvalidClientError('Unknown client_id')
    }
    return known
  }

  /**
   * Fetch (or reuse) the metadata document a CIMD `client_id` names.
   *
   * The fetch is a server-side request to a caller-supplied URL, so it goes
   * through the same guard as every other outbound fetch:
   * `validateUrlForFetching` rejects the obviously bad strings before DNS, and
   * `NodeHttpFetcher` re-checks the address it actually connects to on every
   * hop. Three rules are CIMD's own: https only, a path (an origin names no
   * document), and a size cap.
   */
  private async resolveClientIdMetadataDocument(
    clientId: string
  ): Promise<OAuthClient> {
    const url = this.validateMetadataUrl(clientId)

    const cached = await this.findClient(clientId)
    if (cached && isFresh(cached.metadataFetchedAt)) {
      return cached
    }

    const document = await this.fetchClientIdMetadataDocument(url, clientId)
    const { redirectUris, grantTypes, authMethod } =
      requireClientRules(document)
    const fetchedAt = new Date()

    if (cached) {
      const updated = await this.clientRepository.update(cached.id, {
        clientName: document.client_name ?? null,
        redirectUris,
        grantTypes,
        tokenEndpointAuthMethod: authMethod,
        metadataUrl: clientId,
        metadataFetchedAt: fetchedAt,
      })
      return updated ?? cached
    }

    return this.clientRepository.create({
      clientId,
      clientName: document.client_name ?? null,
      redirectUris,
      grantTypes,
      tokenEndpointAuthMethod: authMethod,
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

    // draft-ietf-oauth-client-id-metadata-document, section 3: no fragment or
    // userinfo, and client ids compare as exact strings, never normalized.
    if (
      url.href !== clientId ||
      clientId.includes('#') ||
      url.username !== '' ||
      url.password !== ''
    ) {
      throw new OAuthInvalidClientError(
        'A client_id URL must be in canonical form, with no fragment or userinfo'
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
      body = await this.httpFetcher.fetch(url, {
        redirect: 'error',
        maxBytes: MAX_CIMD_DOCUMENT_BYTES,
      })
    } catch (error) {
      if (error instanceof ResponseTooLargeError) {
        throw new OAuthInvalidClientMetadataError(
          'The client metadata document is too large'
        )
      }
      // Whatever went wrong out there, the client_id is unusable here. The
      // reason is not echoed back: it describes somebody else's server. It is
      // kept as the cause, for the log.
      throw new OAuthInvalidClientError(
        'The client metadata document could not be fetched',
        { cause: error }
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

function invalidCode(): OAuthInvalidGrantError {
  return new OAuthInvalidGrantError(
    'The authorization code is invalid, expired, or already used'
  )
}

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
    const noun = unknown.length === 1 ? 'scope' : 'scopes'
    throw new OAuthInvalidScopeError(
      `${unknown.length} unknown ${noun} requested. This server grants ${SUPPORTED_SCOPES.join(', ')}`
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
function requireClientRules(metadata: {
  redirect_uris: string[]
  grant_types?: string[]
  token_endpoint_auth_method?: string
}): { redirectUris: string[]; grantTypes: string[]; authMethod: 'none' } {
  if ((metadata.token_endpoint_auth_method ?? 'none') !== 'none') {
    throw new OAuthInvalidClientMetadataError(
      'This server registers public clients only (token_endpoint_auth_method must be none)'
    )
  }

  const grantTypes = metadata.grant_types ?? DEFAULT_GRANT_TYPES
  const unsupported = grantTypes.filter(
    grant => !DEFAULT_GRANT_TYPES.includes(grant)
  )
  if (unsupported.length > 0) {
    throw new OAuthInvalidClientMetadataError(
      `Unsupported grant type: ${unsupported.join(', ')}`
    )
  }

  const unusable = metadata.redirect_uris.find(uri => !isUsableRedirectUri(uri))
  if (unusable !== undefined) {
    throw new OAuthInvalidClientMetadataError(
      `redirect_uri must be https, or http on loopback, with no fragment or userinfo: ${unusable}`
    )
  }

  return {
    redirectUris: metadata.redirect_uris,
    grantTypes,
    authMethod: 'none',
  }
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
      .map(uri => redirectUriDedupKey(uri))
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

/**
 * Mint an access token, and a refresh token when the grant has one.
 *
 * Returns the rows to store and the raw values to hand back; storing them is
 * the caller's one write. Both tokens carry the audience the grant was made
 * for, because the audience check at the resource server is the
 * confused-deputy defense (Decision 15) and a refresh that could widen it
 * would walk straight around it.
 */
function mintTokens(grant: {
  clientId: string
  userId: string
  accessScopes: string[]
  refreshScopes: string[] | null
  resource: string
  grantId: string
  rotatedFrom?: string
}): { rows: IssuedTokenData; issued: IssuedTokens } {
  const shared = {
    clientId: grant.clientId,
    userId: grant.userId,
    resource: grant.resource,
    grantId: grant.grantId,
  }

  const accessToken = ACCESS_TOKEN_PREFIX + generateSecureToken()
  const rows: IssuedTokenData = [
    {
      ...shared,
      tokenHash: hashToken(accessToken),
      kind: 'access',
      scopes: grant.accessScopes,
      expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
    },
  ]

  let refreshToken: string | null = null
  if (grant.refreshScopes) {
    refreshToken = generateSecureToken()
    rows.push({
      ...shared,
      tokenHash: hashToken(refreshToken),
      kind: 'refresh',
      scopes: grant.refreshScopes,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      rotatedFrom: grant.rotatedFrom ?? null,
    })
  }

  return {
    rows,
    issued: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      scopes: grant.accessScopes,
      resource: grant.resource,
    },
  }
}
