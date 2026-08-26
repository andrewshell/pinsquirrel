/**
 * How the client came to be registered.
 *
 * - `cimd`: the `client_id` is an HTTPS URL naming a metadata document this
 *   server fetched and validated. The preferred path (Decision 13).
 * - `dcr`: the client posted its metadata to `/oauth/register` (RFC 7591).
 *   Anyone can do this, so these rows are the ones the sweep bounds.
 * - `static`: entered by an operator. Never swept.
 */
export type OAuthClientRegistrationType = 'cimd' | 'dcr' | 'static'

export interface OAuthClient {
  id: string
  /**
   * The public identifier the client sends. For CIMD this is the HTTPS URL of
   * its metadata document; for DCR a generated value. Unique across clients,
   * and what authorization codes and tokens reference.
   */
  clientId: string
  /** Shown on the consent screen. Null when the client supplied no name. */
  clientName: string | null
  redirectUris: string[]
  grantTypes: string[]
  tokenEndpointAuthMethod: string
  registrationType: OAuthClientRegistrationType
  /** The CIMD document URL. Null for `dcr` and `static` clients. */
  metadataUrl: string | null
  /** When that document was last fetched, for cache freshness. */
  metadataFetchedAt: Date | null
  /**
   * When this registration first completed an authorization. Null means it
   * never did, which is what makes a `dcr` row eligible for the TTL sweep:
   * an anonymous caller can create rows, and Claude registers afresh on every
   * new connection, so unused registrations must not accumulate forever.
   */
  completedAt: Date | null
  createdAt: Date
}

export interface CreateOAuthClientData {
  clientId: string
  clientName?: string | null
  redirectUris: string[]
  grantTypes: string[]
  tokenEndpointAuthMethod: string
  registrationType: OAuthClientRegistrationType
  metadataUrl?: string | null
  metadataFetchedAt?: Date | null
}

/**
 * What a re-fetch of a CIMD document may change. `clientId` and
 * `registrationType` are not updatable: a different identifier is a different
 * client, and a registration does not change how it was made.
 */
export interface UpdateOAuthClientData {
  clientName?: string | null
  redirectUris?: string[]
  grantTypes?: string[]
  tokenEndpointAuthMethod?: string
  metadataUrl?: string | null
  metadataFetchedAt?: Date | null
}
