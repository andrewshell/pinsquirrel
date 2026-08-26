import type { AccessGateable } from './access.js'

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
  createdAt: Date
}

export interface CreateOAuthTokenData {
  tokenHash: string
  kind: OAuthTokenKind
  clientId: string
  userId: string
  scopes: string[]
  resource: string
  expiresAt: Date
  rotatedFrom?: string | null
}
