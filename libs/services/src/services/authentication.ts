import type { AccessControl, UserRepository, User } from '@pinsquirrel/domain'
import { Role, UserStatus } from '@pinsquirrel/domain'
import {
  InvalidCredentialsError,
  EmailVerificationRequiredError,
  MissingRoleError,
  AccessNotGrantedError,
  UserNotFoundError,
  UserNotEligibleError,
  CannotRevokeOwnRoleError,
  UnauthorizedUserAccessError,
} from '@pinsquirrel/domain'
import { hashPassword, verifyPassword, getDummyHash } from '../utils/crypto.js'
import { credentialsSchema, passwordChangeSchema } from '../validation/user.js'
import { validationErrorFromZod } from '../validation/zod-error.js'

/**
 * Seals an email so the waitlist can be contacted later. Implemented with a
 * public key; the server cannot reverse it (only the offline admin app can).
 */
export interface EmailSealer {
  seal(email: string): Promise<string>
}

/**
 * Authentication and the user-lifecycle changes that need nothing but the user
 * store: signing in, admitting a user, granting and revoking roles, and
 * changing a known password.
 *
 * Everything requiring the email pipeline or reset tokens lives in
 * AccountService, so this service's single dependency is always satisfiable —
 * apps/admin and the private-mode unlock construct it with just the repository.
 */
export class AuthenticationService {
  constructor(private readonly userRepository: UserRepository) {}

  async login(input: { username: string; password: string }): Promise<User> {
    // Validate inputs at service boundary
    const result = credentialsSchema.safeParse(input)
    if (!result.success) {
      throw validationErrorFromZod(result.error)
    }

    const user = await this.userRepository.findByUsername(input.username)
    const passwordHash = user?.passwordHash ?? getDummyHash()
    const isValidPassword = await verifyPassword(input.password, passwordHash)

    if (!user || !user.passwordHash || !isValidPassword) {
      throw new InvalidCredentialsError()
    }

    // Check if user has the User role
    if (!user.roles.includes(Role.User)) {
      throw new MissingRoleError()
    }

    // Only users who have been granted access can sign in. Verified accounts
    // awaiting an access grant are still on the early-access waitlist.
    if (user.status !== UserStatus.Active) {
      throw new AccessNotGrantedError()
    }

    return user
  }

  /**
   * Grant a user access to the application, moving them off the early-access
   * waitlist and into the active state. Idempotent: granting an already-active
   * user is a no-op. Admin-only, and checked here rather than by the caller:
   * apps/admin is the only caller today, but the rule belongs to the
   * operation, not to whichever transport happens to reach it.
   */
  async grantAccess(ac: AccessControl, userId: string): Promise<User> {
    if (!ac.hasRole(Role.Admin)) {
      throw new MissingRoleError()
    }

    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundError(userId)
    }

    if (user.status === UserStatus.Active) {
      return user
    }

    // Only a verified account waiting on the list can be admitted. Activating
    // an unverified one would strand it as Active with no password; setting a
    // password later runs resetPassword, whose Unverified guard no longer
    // matches, leaving an account that reached Active without ever being on
    // the waitlist.
    if (user.status !== UserStatus.Waitlist) {
      throw new UserNotEligibleError(
        user.status,
        `User "${user.username}" has not confirmed their email yet`
      )
    }

    const updated = await this.userRepository.update(userId, {
      status: UserStatus.Active,
    })
    if (!updated) {
      throw new UserNotFoundError(userId)
    }

    return updated
  }

  /**
   * Add one role to a user.
   *
   * Roles are additive: the other roles and the user's status are left
   * untouched. Idempotent — granting a role the user already holds is a no-op.
   *
   * Admin-only, enforced here for the same reason as grantAccess.
   */
  async grantRole(
    ac: AccessControl,
    userId: string,
    role: Role
  ): Promise<User> {
    if (!ac.hasRole(Role.Admin)) {
      throw new MissingRoleError()
    }

    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundError(userId)
    }

    if (user.roles.includes(role)) {
      return user
    }

    await this.userRepository.addRole(userId, role)

    return this.rereadUser(userId)
  }

  /**
   * Take one role off a user.
   *
   * The mirror of grantRole, with one rule of its own: an admin cannot revoke
   * a role from their own account. Dropping Admin would close the console they
   * are standing in, and dropping User suspends sign-in altogether — both need
   * a second admin to undo, so neither is offered as a self-service mistake.
   *
   * Idempotent; revoking a role the user does not hold writes nothing.
   */
  async revokeRole(
    ac: AccessControl,
    userId: string,
    role: Role
  ): Promise<User> {
    if (!ac.hasRole(Role.Admin)) {
      throw new MissingRoleError()
    }

    // Checked before the read: whose account this is does not depend on the
    // row, and a self-revoke should cost nothing.
    if (ac.user?.id === userId) {
      throw new CannotRevokeOwnRoleError(role)
    }

    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundError(userId)
    }

    if (!user.roles.includes(role)) {
      return user
    }

    await this.userRepository.removeRole(userId, role)

    return this.rereadUser(userId)
  }

  /**
   * Re-read a user after a role write.
   *
   * addRole/removeRole resolve to void, so the updated roles only exist in the
   * store; a caller that renders the result needs them back.
   */
  private async rereadUser(userId: string): Promise<User> {
    const updated = await this.userRepository.findById(userId)
    if (!updated) {
      throw new UserNotFoundError(userId)
    }

    return updated
  }

  /**
   * Change a user's own password. Only the account holder may do this — an
   * admin cannot change someone else's password through this path.
   */
  async changePassword(
    ac: AccessControl,
    input: {
      userId: string
      currentPassword: string
      newPassword: string
    }
  ): Promise<void> {
    if (!ac.canUpdate({ userId: input.userId })) {
      throw new UnauthorizedUserAccessError(input.userId)
    }

    // Validate inputs at service boundary
    const result = passwordChangeSchema.safeParse(input)
    if (!result.success) {
      throw validationErrorFromZod(result.error)
    }

    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new InvalidCredentialsError()
    }

    // Check if user has completed email verification (set password)
    if (!user.passwordHash) {
      throw new EmailVerificationRequiredError()
    }

    const isValidPassword = await verifyPassword(
      input.currentPassword,
      user.passwordHash
    )
    if (!isValidPassword) {
      throw new InvalidCredentialsError()
    }

    // Hash the new password in the business logic layer
    const passwordHash = await hashPassword(input.newPassword)

    // Persist only the field this operation owns to avoid clobbering a
    // concurrent username/email change made after the findById read.
    await this.userRepository.update(input.userId, { passwordHash })
  }
}
