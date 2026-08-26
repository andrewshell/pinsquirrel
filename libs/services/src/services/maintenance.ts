import type {
  OAuthAuthorizationCodeRepository,
  OAuthClientRepository,
  OAuthTokenRepository,
  PasswordResetRepository,
  SessionRepository,
} from '@pinsquirrel/domain'

/**
 * How long a dynamic registration has to be used before it is swept.
 *
 * A policy, not a property of the row, which is why the repository is handed
 * the cutoff rather than computing it. Anyone can create an `oauth_clients`
 * row through dynamic registration and Claude registers afresh on every new
 * connection, so a registration that never authorized anybody has a deadline.
 * One that did is kept: `completed_at` is what takes it out of this sweep.
 */
const INCOMPLETE_CLIENT_TTL_MS = 24 * 60 * 60 * 1000

/** What one sweep removed, per store. */
export interface SweepResult {
  sessions: number
  passwordResetTokens: number
  oauthAuthorizationCodes: number
  oauthTokens: number
  oauthClients: number
}

/**
 * The scheduled removal of rows that have outlived their expiry.
 *
 * Sessions, password-reset tokens and the three OAuth stores all carry an
 * expiry that every read already honours, so nothing was ever wrong — the rows
 * simply accumulated forever. One service rather than a caller reaching for
 * five repositories, and one scheduled job rather than one per store.
 *
 * There is no `AccessControl` here on purpose: a sweep has no caller to
 * authorize, and the rows it removes are ones no request could still use.
 */
export class MaintenanceService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly oauthClientRepository: OAuthClientRepository,
    private readonly oauthCodeRepository: OAuthAuthorizationCodeRepository,
    private readonly oauthTokenRepository: OAuthTokenRepository
  ) {}

  /**
   * Remove every expired row, and report how many that was.
   *
   * The stores are swept independently — one failing store must not leave the
   * others untouched — but a failure is still reported, so a sweep that has
   * been silently failing for a month cannot look like a sweep that had
   * nothing to do.
   */
  async sweepExpired(): Promise<SweepResult> {
    const [
      sessions,
      passwordResetTokens,
      oauthAuthorizationCodes,
      oauthTokens,
      oauthClients,
    ] = await Promise.all([
      this.sessionRepository.deleteExpiredSessions(),
      this.passwordResetRepository.deleteExpiredTokens(),
      // Spent codes are kept until they expire, so a replay is still
      // recognisable while the code could plausibly be presented again.
      this.oauthCodeRepository.deleteExpiredCodes(),
      // Expired, revoked and rotated alike: none of them can authenticate
      // anything again.
      this.oauthTokenRepository.deleteExpiredTokens(),
      this.oauthClientRepository.deleteExpiredIncompleteClients(
        new Date(Date.now() - INCOMPLETE_CLIENT_TTL_MS)
      ),
    ])

    return {
      sessions,
      passwordResetTokens,
      oauthAuthorizationCodes,
      oauthTokens,
      oauthClients,
    }
  }
}
