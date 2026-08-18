import type { UserRepository, User } from '@pinsquirrel/domain'
import { Role, UserStatus } from '@pinsquirrel/domain'
import {
  InvalidCredentialsError,
  EmailVerificationRequiredError,
  ValidationError,
  MissingRoleError,
  AccessNotGrantedError,
  UserNotFoundError,
  UserNotEligibleError,
} from '@pinsquirrel/domain'
import { hashPassword, verifyPassword, getDummyHash } from '../utils/crypto.js'
import { usernameSchema, passwordSchema } from '../validation/user.js'

/**
 * Seals an email so the waitlist can be contacted later. Implemented with a
 * public key; the server cannot reverse it (only the offline admin app can).
 */
export interface EmailSealer {
  seal(email: string): Promise<string>
}

/**
 * Authentication and the user-lifecycle changes that need nothing but the user
 * store: signing in, admitting a user, granting the Admin role, and changing a
 * known password.
 *
 * Everything requiring the email pipeline or reset tokens lives in
 * AccountService, so this service's single dependency is always satisfiable —
 * apps/admin and the private-mode unlock construct it with just the repository.
 */
export class AuthenticationService {
  constructor(private readonly userRepository: UserRepository) {}

  async login(input: { username: string; password: string }): Promise<User> {
    // Validate inputs at service boundary
    const errors: Record<string, string[]> = {}

    const usernameResult = usernameSchema.safeParse(input.username)
    if (!usernameResult.success) {
      errors.username = [
        usernameResult.error.issues[0]?.message || 'Invalid username',
      ]
    }

    const passwordResult = passwordSchema.safeParse(input.password)
    if (!passwordResult.success) {
      errors.password = [
        passwordResult.error.issues[0]?.message || 'Invalid password',
      ]
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
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
   * user is a no-op. Intended for manual/admin use.
   */
  async grantAccess(userId: string): Promise<User> {
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
   * Add the Admin role to a user.
   *
   * Roles are additive: existing roles and the user's status are left
   * untouched. Idempotent — granting to an existing admin is a no-op.
   */
  async grantAdmin(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundError(userId)
    }

    if (user.roles.includes(Role.Admin)) {
      return user
    }

    await this.userRepository.addRole(userId, Role.Admin)

    // addRole resolves to void, so re-read to return the updated roles.
    const updated = await this.userRepository.findById(userId)
    if (!updated) {
      throw new UserNotFoundError(userId)
    }

    return updated
  }

  async changePassword(input: {
    userId: string
    currentPassword: string
    newPassword: string
  }): Promise<void> {
    // Validate inputs at service boundary
    const errors: Record<string, string[]> = {}

    const currentPasswordResult = passwordSchema.safeParse(
      input.currentPassword
    )
    if (!currentPasswordResult.success) {
      errors.currentPassword = [
        currentPasswordResult.error.issues[0]?.message || 'Invalid password',
      ]
    }

    const newPasswordResult = passwordSchema.safeParse(input.newPassword)
    if (!newPasswordResult.success) {
      errors.newPassword = [
        newPasswordResult.error.issues[0]?.message || 'Invalid password',
      ]
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
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
