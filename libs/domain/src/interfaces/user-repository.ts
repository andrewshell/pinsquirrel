import type { User, CreateUserData, UpdateUserData } from '../entities/user.js'
import type { Role } from '../entities/role.js'
import type { UserStatus } from '../entities/user-status.js'
import type { Repository } from './repository.js'

export interface UserRepository extends Repository<
  User,
  CreateUserData,
  UpdateUserData
> {
  findByEmailHash(emailHash: string): Promise<User | null>
  findByUsername(username: string): Promise<User | null>
  findByStatus(status: UserStatus): Promise<User[]>
  addRole(userId: string, role: Role): Promise<void>
  /** Idempotent: removing a role the user does not hold is a no-op. */
  removeRole(userId: string, role: Role): Promise<void>
  /**
   * How many users hold a role, without loading any of them.
   *
   * Exists so "does this system have an admin yet?" can be answered by a
   * caller that is not one — listing the users would need the role it is
   * asking about.
   */
  countByRole(role: Role): Promise<number>
  /**
   * Write `next` as the password hash only if the stored one is still
   * `expected`. Resolves false when it was changed in the meantime.
   */
  replacePasswordHash(
    id: string,
    expected: string,
    next: string
  ): Promise<boolean>
  /**
   * Delete the user only while it is still unverified and was created before
   * `createdBefore`. True when it was deleted.
   */
  deleteStaleUnverified(id: string, createdBefore: Date): Promise<boolean>
  /**
   * Write a new password hash and end what was issued under the old one, in
   * one transaction: every web session but `keepSessionId`, every OAuth
   * token and unused authorization code, and the pending email change.
   *
   * With `resetTokenId` the change also spends that reset token and the
   * user's others. Resolves false, with nothing changed, when that token is
   * gone or expired, or when the user is gone. Of concurrent calls with one
   * token, at most one resolves true.
   *
   * A `WriteConflictError` means nothing changed and the call can be retried.
   */
  setPasswordAndRevoke(userId: string, change: PasswordChange): Promise<boolean>
  /**
   * Remove a role and end every web session, OAuth token and unused
   * authorization code issued to the user, and their pending email change,
   * in one transaction. A `WriteConflictError` means nothing changed.
   */
  removeRoleAndRevoke(userId: string, role: Role): Promise<void>
}

export interface PasswordChange {
  passwordHash: string
  /** Written with the hash; the status is left alone without it. */
  status?: UserStatus
  keepSessionId?: string
  resetTokenId?: string
}
