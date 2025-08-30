import type {
  AccessControl,
  UpdateUserData,
  User,
  UserRepository,
} from '@pinsquirrel/domain'
import {
  AuthenticationError,
  InvalidCredentialsError,
} from '@pinsquirrel/domain'

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Get a user by their ID - requires authentication and ownership
   */
  async getUser(ac: AccessControl, userId: string): Promise<User> {
    if (!ac.user) {
      throw new AuthenticationError(
        'User must be authenticated to view user data'
      )
    }

    // For users, we check if the authenticated user ID matches the requested user ID
    if (ac.user.id !== userId) {
      throw new InvalidCredentialsError()
    }

    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new InvalidCredentialsError()
    }

    return user
  }

  /**
   * Get a user by their username - public method for profile access
   */
  async getUserByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username)
  }

  /**
   * Update user data - requires authentication and ownership
   */
  async updateUser(
    ac: AccessControl,
    userId: string,
    data: UpdateUserData
  ): Promise<User> {
    const existingUser = await this.userRepository.findById(userId)
    if (!existingUser) {
      throw new InvalidCredentialsError()
    }

    if (!ac.canUpdate(existingUser)) {
      throw new InvalidCredentialsError()
    }

    const updatedUser = await this.userRepository.update(userId, data)
    if (!updatedUser) {
      throw new InvalidCredentialsError()
    }

    return updatedUser
  }
}
