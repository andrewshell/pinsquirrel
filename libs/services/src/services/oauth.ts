import type {
  HttpFetcher,
  OAuthAuthorizationCodeRepository,
  OAuthClient,
  OAuthClientRepository,
  OAuthTokenRepository,
  UserRepository,
} from '@pinsquirrel/domain'
import {
  OAuthInvalidClientError,
  OAuthInvalidClientMetadataError,
} from '@pinsquirrel/domain'
import {
  clientIdMetadataDocumentSchema,
  type ClientIdMetadataDocument,
} from '../validation/oauth.js'
import { validateUrlForFetching } from '../validation/url.js'

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

function looksLikeUrl(clientId: string): boolean {
  return /^https?:\/\//i.test(clientId)
}

function isFresh(fetchedAt: Date | null): boolean {
  if (!fetchedAt) return false
  return Date.now() - fetchedAt.getTime() < CIMD_CACHE_TTL_MS
}
