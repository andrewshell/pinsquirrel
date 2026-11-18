import type {
  AuthorizationCode,
  CodeExchangeOutcome,
  CreateAuthorizationCodeData,
  IssuedTokenData,
} from '../entities/oauth-grant.js'

export interface OAuthAuthorizationCodeRepository {
  findById(id: string): Promise<AuthorizationCode | null>

  findByCodeHash(codeHash: string): Promise<AuthorizationCode | null>

  /**
   * Write a code, but only while `sessionId` is still one of the user's
   * sessions, and return null when it is not.
   *
   * The session check and the insert are one step: a revocation of the user's
   * sessions either precedes it, and nothing is written, or follows it, and
   * deletes the code with the user's other unspent codes.
   */
  create(
    data: CreateAuthorizationCodeData,
    sessionId: string
  ): Promise<AuthorizationCode | null>

  /**
   * Spend a code and write the tokens it stands for, as one step.
   *
   * Either the code is marked spent and every token is stored, or nothing
   * changed. The mark is conditional, so of two concurrent exchanges of one
   * code exactly one is `exchanged`; a failure while writing the tokens
   * leaves the code unspent for the client to retry with.
   *
   * It also cannot overlap a revocation of the user's tokens: the revocation
   * either ran first, and the code is `gone`, or runs after and takes the new
   * tokens with the rest.
   */
  exchange(
    codeId: string,
    tokens: IssuedTokenData
  ): Promise<CodeExchangeOutcome>

  /**
   * Spend a code and issue nothing, for an exchange that failed a check: the
   * code must not stay alive to try again with. Returns the code if this call
   * was the one that spent it, and null if it was already spent, expired, or
   * never existed.
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
