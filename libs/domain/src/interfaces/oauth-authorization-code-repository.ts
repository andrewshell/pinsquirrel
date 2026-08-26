import type {
  AuthorizationCode,
  CreateAuthorizationCodeData,
} from '../entities/oauth-grant.js'

export interface OAuthAuthorizationCodeRepository {
  findById(id: string): Promise<AuthorizationCode | null>

  findByCodeHash(codeHash: string): Promise<AuthorizationCode | null>

  create(data: CreateAuthorizationCodeData): Promise<AuthorizationCode>

  /**
   * Spend a code, once.
   *
   * Returns the code if this call was the one that consumed it, and null if
   * it was already spent, expired, or never existed. The check and the mark
   * are one statement rather than a read followed by a write, because two
   * concurrent exchanges of the same code must not both succeed — that is
   * the single-use guarantee OAuth 2.1 requires, and a read-then-write loses
   * the race.
   */
  consume(codeHash: string): Promise<AuthorizationCode | null>

  delete(id: string): Promise<boolean>

  /**
   * Remove codes past their expiry, spent or not, and report how many.
   * Same sweep and same shape as `SessionRepository.deleteExpiredSessions`.
   * Spent codes stay until expiry so a replay is still recognisable.
   */
  deleteExpiredCodes(): Promise<number>
}
