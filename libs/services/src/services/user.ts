import type { AccessControl, User, UserRepository } from '@pinsquirrel/domain'
import { MissingRoleError, Role, UserStatus } from '@pinsquirrel/domain'

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Every user in a given lifecycle state.
   *
   * Admin-only, and checked here rather than by the caller: this is how the
   * admin app gets the waitlist whose sealed addresses it then decrypts, so
   * the query carries its own authorization instead of trusting whichever
   * app happens to call it.
   */
  async listByStatus(ac: AccessControl, status: UserStatus): Promise<User[]> {
    if (!ac.hasRole(Role.Admin)) {
      throw new MissingRoleError()
    }

    return this.userRepository.findByStatus(status)
  }

  /**
   * Whether the system has been bootstrapped: does anyone hold Admin?
   *
   * Deliberately ungated. Every other query on this service answers "what is
   * in the database"; this one answers "has anyone been put in charge of it
   * yet", which is a fact about the deployment rather than about any user: it
   * names nobody, counts nobody, and reveals only a single bit that a fresh
   * install advertises anyway by having no way in.
   *
   * Gating it on Admin would be circular. The caller is the admin console's
   * bootstrap gate, which runs precisely when no admin exists and so has no
   * Admin role to present; requiring one would make the answer unreachable in
   * the only situation where it is not already obvious. Nothing is granted
   * here either — AuthenticationService.bootstrapAdmin re-checks the same
   * count for itself before it writes, so a stale or forged `true` buys a
   * caller nothing.
   */
  async hasAdmin(): Promise<boolean> {
    return (await this.userRepository.countByRole(Role.Admin)) > 0
  }

  /**
   * Get a user by their username - public method for profile access
   */
  async getUserByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username)
  }
}
