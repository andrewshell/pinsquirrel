import type { User } from '../entities/user.js'

export interface AuthenticationService {
  /**
   * Register a new user with username and password
   * @throws {UserAlreadyExistsError} if username is already taken
   */
  register(username: string, password: string, email?: string): Promise<User>

  /**
   * Authenticate a user with username and password
   * @throws {InvalidCredentialsError} if credentials are invalid
   */
  login(username: string, password: string): Promise<User>

  /**
   * Update user's password
   * @throws {InvalidCredentialsError} if current password is incorrect
   */
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void>

  /**
   * Update user's email
   */
  updateEmail(userId: string, email: string | null): Promise<void>

  /**
   * Find user by email (hashes email before lookup)
   */
  findByEmail(email: string): Promise<User | null>
}
