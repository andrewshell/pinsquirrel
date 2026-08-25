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
   * Get a user by their username - public method for profile access
   */
  async getUserByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username)
  }
}
