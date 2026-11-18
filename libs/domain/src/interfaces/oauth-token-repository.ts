import type {
  OAuthToken,
  CreateOAuthTokenData,
  IssuedTokenData,
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

  create(data: CreateOAuthTokenData): Promise<OAuthToken>

  /** Kill one token. False if it was already revoked or does not exist. */
  revoke(id: string): Promise<boolean>

  /**
   * Kill every live token a user holds for one client, whichever grant it
   * came from, and report how many. What the profile page's Revoke does, and
   * what stands in for `revokeByGrant` on a token from before grant ids.
   */
  revokeByUserAndClient(userId: string, clientId: string): Promise<number>

  /**
   * Kill every live token of one grant and report how many. The access token
   * and the refresh token go together, or the client keeps working until the
   * access token expires. Another grant of the same user and client, which is
   * the same application on another device, is left alone.
   */
  revokeByGrant(userId: string, grantId: string): Promise<number>

  /**
   * Retire a refresh token and write its successors, as one step.
   *
   * Either the token is marked rotated and every successor is stored, or
   * nothing changed. False, with nothing written, when the token was already
   * rotated or revoked: the mark is conditional, so of two concurrent
   * rotations of one token exactly one wins. A failure while writing the
   * successors leaves the token unrotated for the client to retry with.
   *
   * Rotation is distinct from `revoke` so that a later presentation of the
   * token is recognisable as a replay rather than a user revocation. A token
   * from before grant ids takes the grant of its successors.
   *
   * It cannot overlap a revocation either: see `exchange` on the code
   * repository.
   */
  rotate(tokenId: string, successors: IssuedTokenData): Promise<boolean>

  /**
   * Remove expired and revoked tokens and report how many. A rotated refresh
   * token is kept until its own expiry. Joins the sweep in the shape of
   * `SessionRepository.deleteExpiredSessions`.
   */
  deleteExpiredTokens(): Promise<number>
}
