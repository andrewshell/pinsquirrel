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
  /** Delete the tokens that expired before `expiredBefore`. */
  deleteExpiredTokens(expiredBefore: Date): Promise<number>
  isValidToken(tokenHash: string): Promise<boolean>
}
