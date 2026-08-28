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
  CannotDeleteOwnAccountError,
  UnauthorizedUserAccessError,
  AdminAlreadyExistsError,
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

  /**
   * Who these credentials belong to, if they are good for signing in at all.
   *
   * Everything the two sign-in paths agree on: the submission is well formed,
   * the password matches, and the account holds the User role. Split out so
   * the bootstrap path cannot drift from it — a second copy of the dummy-hash
   * comparison would be a second place for the timing to go wrong.
   *
   * Which account *states* are acceptable is left to the caller, because that
   * is the only thing the two differ on.
   */
  private async verifyCredentials(input: {
    username: string
    password: string
  }): Promise<User> {
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

    return user
  }

  async login(input: { username: string; password: string }): Promise<User> {
    const user = await this.verifyCredentials(input)

    // Only users who have been granted access can sign in. Verified accounts
    // awaiting an access grant are still on the early-access waitlist.
    if (user.status !== UserStatus.Active) {
      throw new AccessNotGrantedError()
    }

    return user
  }

  /**
   * Sign in to claim the first admin role, on a system that has none.
   *
   * `login()` requires an Active account, and on a fresh database no account
   * can be Active: reaching that state needs `grantAccess`, which needs an
   * admin, which is what is missing. The cold start has to accept the operator
   * where they actually are — on the waitlist — or it does not start.
   *
   * That is not a way around the Active rule, because of what surrounds it:
   *
   * - The credentials are checked first, so this is never an oracle for
   *   whether an environment has been bootstrapped.
   * - It is refused outright once any admin exists, so the widened states are
   *   reachable for exactly as long as nobody can grant access at all — and
   *   the very first claim closes that window for good.
   * - Unverified accounts stay out, on `grantAccess`'s reasoning: an account
   *   that never confirmed its email has proved nothing, and the claim that
   *   follows this sign-in would carry it to Active.
   *
   * The account it returns is still not Active. `bootstrapAdmin` is what
   * admits it, and it re-checks all of this for itself.
   */
  async loginForBootstrap(input: {
    username: string
    password: string
  }): Promise<User> {
    const user = await this.verifyCredentials(input)

    if ((await this.userRepository.countByRole(Role.Admin)) > 0) {
      throw new AdminAlreadyExistsError()
    }

    this.requireBootstrapEligible(user)

    return user
  }

  /**
   * The account states a bootstrap claim may act on.
   *
   * Waitlist and Active both mean the email was confirmed. Unverified does
   * not, and activating such an account would strand it: `resetPassword`'s
   * Unverified guard would no longer match, leaving it Active with no way to
   * set a password. `grantAccess` refuses it for the same reason.
   */
  private requireBootstrapEligible(user: User): void {
    if (user.status === UserStatus.Unverified) {
      throw new UserNotEligibleError(
        user.status,
        `User "${user.username}" has not confirmed their email yet`
      )
    }
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
   * Delete a user and, via the schema's cascades, everything they own — pins,
   * tags, sessions, tokens, roles. There is no undo.
   *
   * Admin-only, enforced here for the same reason as grantAccess. The one rule
   * of its own mirrors revokeRole's: not on the caller's own account, since
   * that is every self-lockout revokeRole refuses at once, and could take the
   * system's last admin with it.
   *
   * Returns the user as they were, so the caller can still name who is gone.
   */
  async deleteUser(ac: AccessControl, userId: string): Promise<User> {
    if (!ac.hasRole(Role.Admin)) {
      throw new MissingRoleError()
    }

    // Checked before the read, as in revokeRole: whose account this is does
    // not depend on the row.
    if (ac.user?.id === userId) {
      throw new CannotDeleteOwnAccountError()
    }

    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundError(userId)
    }

    await this.userRepository.delete(userId)

    return user
  }

  /**
   * Claim the first Admin role on a system that has none.
   *
   * The one operation here that takes no `AccessControl`, and the reason is
   * that there is nobody who could supply a useful one: on a fresh database no
   * account holds Admin, so requiring an admin's authorization to create the
   * first admin has no answer. The invariant is the guard instead — the count
   * is re-read here, immediately before the write, and any admin at all makes
   * this a refusal. That admits at most the first claimant and then closes for
   * good; every later role change goes through grantRole, which does require
   * an admin.
   *
   * The caller still has to be signed in — it passes the userId off its own
   * session — so the claim is not open to the world, only to whichever
   * authenticated account reaches an unbootstrapped system first. That is the
   * same trust the operator already places in `login()`, which requires an
   * Active account with the User role.
   *
   * The window between the check and the write is small but real. It is not
   * closed here: two simultaneous claimants would both become admins, which
   * leaves the system administered rather than broken, and the console is
   * reached by one operator on a fresh deployment.
   *
   * The claimant is admitted as well as promoted. On a fresh database their
   * account is still on the waitlist — nobody existed who could have let them
   * in — and an Admin role on an account `login()` turns away is a role nobody
   * can use. Both halves answer to the same invariant, so they happen together
   * or not at all.
   */
  async bootstrapAdmin(userId: string): Promise<User> {
    if ((await this.userRepository.countByRole(Role.Admin)) > 0) {
      throw new AdminAlreadyExistsError()
    }

    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundError(userId)
    }

    this.requireBootstrapEligible(user)

    if (user.status === UserStatus.Waitlist) {
      const activated = await this.userRepository.update(userId, {
        status: UserStatus.Active,
      })
      if (!activated) {
        throw new UserNotFoundError(userId)
      }
    }

    await this.userRepository.addRole(userId, Role.Admin)

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
