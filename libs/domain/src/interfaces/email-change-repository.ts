import type { CreateEmailChangeData } from '../entities/email-change.js'

export interface EmailChangeRepository {
  /** Store the user's pending change, replacing any earlier one. */
  save(data: CreateEmailChangeData): Promise<void>
  /**
   * Spend the unexpired change with this token hash, write its address to
   * the user and spend the user's password reset tokens. Resolves false, with
   * nothing changed, when the change is gone or expired or another account
   * has the address. Of concurrent calls with one token, at most one resolves
   * true.
   */
  confirm(tokenHash: string): Promise<boolean>
}
