import type { AccessGateable } from './access.js'

/**
 * A grant is one approval of the consent screen: one user letting one client
 * reach one resource with a set of scopes.
 *
 * It has no row of its own. `grantId` names it: `authorize` makes the id when
 * it writes the code, the exchange copies it to the access and refresh
 * tokens, and every rotation copies it to the successors. The grant's scopes
 * are the ones on its refresh token, which a rotation never changes.
 *
 * A null `grantId` is a row written before grants had ids. Such a row is
 * revoked together with everything the user holds for that client, and a
 * refresh token without one is given an id when it rotates.
 */

/**
 * An issued authorization code, stored hashed.
 *
 * The raw code exists only in the redirect that carried it. Everything here
 * is what the token endpoint has to check before exchanging it: that the
 * client and redirect URI match the ones the code was issued to, that the
 * PKCE verifier hashes to `codeChallenge`, and that the code has neither
 * expired nor already been consumed.
 */
export interface AuthorizationCode {
  id: string
  /** SHA-256 of the raw code. The raw value is never stored. */
  codeHash: string
  /** The `client_id` of the client this code was issued to. */
  clientId: string
  userId: string
  /** The exact redirect URI used, which the exchange must repeat. */
  redirectUri: string
  /**
   * The PKCE `code_challenge`. `S256` is the only method advertised in the
   * authorization-server metadata and the only one accepted, so the method
   * is not stored: there is nothing for it to distinguish.
   */
  codeChallenge: string
  scopes: string[]
  /** The RFC 8707 `resource` the resulting token will be bound to. */
  resource: string
  /** The grant this code starts. Null only for a code from before grant ids. */
  grantId: string | null
  expiresAt: Date
  /**
   * When the code was exchanged. Non-null means spent: codes are single-use,
   * and a second presentation is a replay, not a retry.
   */
  consumedAt: Date | null
  createdAt: Date
}

export interface CreateAuthorizationCodeData {
  codeHash: string
  clientId: string
  userId: string
  redirectUri: string
  codeChallenge: string
  scopes: string[]
  resource: string
  grantId: string
  expiresAt: Date
}

export type OAuthTokenKind = 'access' | 'refresh'

/**
 * An issued access or refresh token, stored hashed.
 *
 * `AccessGateable` because a user revoking a grant from the profile page is a
 * user-scoped operation like deleting a pin: `AccessControl.canDelete(token)`
 * decides it, and `userId` is the gate.
 */
export interface OAuthToken extends AccessGateable {
  id: string
  /** SHA-256 of the raw token. The raw value is returned once and forgotten. */
  tokenHash: string
  kind: OAuthTokenKind
  clientId: string
  userId: string
  scopes: string[]
  /**
   * The audience (RFC 8707). `/mcp` and `/api/v1` are separate resources, and
   * each rejects a token issued for the other — the confused-deputy defense,
   * so this is compared, never defaulted.
   */
  resource: string
  /** The grant this token belongs to. Null only for a token from before grant ids. */
  grantId: string | null
  expiresAt: Date
  /** Set when a user or client revoked it. Non-null means dead. */
  revokedAt: Date | null
  /**
   * Set when a refresh token was exchanged for a successor. Kept distinct
   * from `revokedAt` so a replayed rotated token can be told apart from one
   * a user deliberately killed.
   */
  rotatedAt: Date | null
  /**
   * The id of the refresh token this one replaced, so a rotation chain can be
   * walked. Null for the first token of a grant.
   */
  rotatedFrom: string | null
  /**
   * When the user approved the grant, carried unchanged through every
   * rotation. Null only for a token from before the column.
   */
  grantedAt: Date | null
  createdAt: Date
}

export interface CreateOAuthTokenData {
  tokenHash: string
  kind: OAuthTokenKind
  clientId: string
  userId: string
  scopes: string[]
  resource: string
  grantId: string
  grantedAt: Date
  expiresAt: Date
  rotatedFrom?: string | null
}

/**
 * The rows one issuance writes: an access token, and a refresh token when the
 * grant has one. Never empty, so a code cannot be spent or a refresh token
 * retired with nothing to show for it.
 */
export type IssuedTokenData = [CreateOAuthTokenData, ...CreateOAuthTokenData[]]

/**
 * How an attempt to spend a code ended. `spent` is a code that was already
 * exchanged, which is a replay. `gone` is one that expired or was deleted.
 */
export type CodeExchangeOutcome = 'exchanged' | 'spent' | 'gone'
