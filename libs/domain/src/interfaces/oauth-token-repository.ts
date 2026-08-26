import type {
  OAuthToken,
  CreateOAuthTokenData,
} from '../entities/oauth-grant.js'

export interface OAuthTokenRepository {
  findById(id: string): Promise<OAuthToken | null>

  /**
   * The bearer-token lookup. The raw token is hashed by the service and only
   * the hash reaches here. Returns the row whatever its state; expiry,
   * revocation, rotation and audience are the service's checks to make.
   */
  findByTokenHash(tokenHash: string): Promise<OAuthToken | null>

  /**
   * Every live token for a user: not expired, not revoked, not rotated. This
   * is what the profile page's grants list is built from.
   */
  findActiveByUserId(userId: string): Promise<OAuthToken[]>

  /** The successor of a rotated refresh token, if one was issued. */
  findByRotatedFrom(tokenId: string): Promise<OAuthToken | null>

  create(data: CreateOAuthTokenData): Promise<OAuthToken>

  /** Kill one token. False if it was already revoked or does not exist. */
  revoke(id: string): Promise<boolean>

  /**
   * Kill every live token a user holds for one client, and report how many.
   * Revoking a grant has to take the access token and the refresh token
   * together, or the client keeps working until the access token expires.
   */
  revokeByUserAndClient(userId: string, clientId: string): Promise<number>

  /**
   * Mark a refresh token as exchanged for a successor. Distinct from
   * `revoke` so that a later presentation of this token is recognisable as a
   * replay of a rotated token rather than a user revocation.
   */
  markRotated(id: string): Promise<boolean>

  /**
   * Remove tokens that can never authenticate again — expired, revoked, or
   * rotated — and report how many. Joins the sweep in the shape of
   * `SessionRepository.deleteExpiredSessions`.
   */
  deleteExpiredTokens(): Promise<number>
}
