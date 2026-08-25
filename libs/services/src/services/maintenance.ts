import type {
  PasswordResetRepository,
  SessionRepository,
} from '@pinsquirrel/domain'

/** What one sweep removed, per store. */
export interface SweepResult {
  sessions: number
  passwordResetTokens: number
}

/**
 * The scheduled removal of rows that have outlived their expiry.
 *
 * Sessions and password-reset tokens both carry an `expires_at` that every
 * read already honours, so nothing was ever wrong — the rows simply
 * accumulated forever. One service rather than a caller reaching for two
 * repositories, so the next store with an expiry (Phase 6d's `oauth_clients`)
 * joins the same sweep instead of growing a second scheduled job.
 *
 * There is no `AccessControl` here on purpose: a sweep has no caller to
 * authorize, and the rows it removes are ones no request could still use.
 */
export class MaintenanceService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly passwordResetRepository: PasswordResetRepository
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
    const [sessions, passwordResetTokens] = await Promise.all([
      this.sessionRepository.deleteExpiredSessions(),
      this.passwordResetRepository.deleteExpiredTokens(),
    ])

    return { sessions, passwordResetTokens }
  }
}
