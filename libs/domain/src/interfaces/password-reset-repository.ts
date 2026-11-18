import type {
  PasswordResetToken,
  CreatePasswordResetTokenData,
} from '../entities/password-reset-token.js'
import type { Repository } from './repository.js'

export interface PasswordResetRepository extends Repository<
  PasswordResetToken,
  CreatePasswordResetTokenData,
  Partial<CreatePasswordResetTokenData>
> {
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>
  findByUserId(userId: string): Promise<PasswordResetToken[]>
  deleteByUserId(userId: string): Promise<boolean>
  /** Delete the tokens that expired before `expiredBefore`. */
  deleteExpiredTokens(expiredBefore: Date): Promise<number>
  isValidToken(tokenHash: string): Promise<boolean>
  /**
   * Delete one unexpired token. True only for the call that deleted it, so of
   * any number of concurrent callers exactly one may act on the token.
   */
  consume(id: string): Promise<boolean>
}
