import type { User } from '../entities/user.js'

export interface AuthenticationService {
  /**
   * Register a new user with username and password
   * @throws {Error} if validation fails
   * @throws {UserAlreadyExistsError} if username is already taken
   */
  register(
    username: string,
    password: string,
    email?: string | null
  ): Promise<User>

  /**
   * Authenticate a user with username and password
   * @throws {Error} if validation fails
   * @throws {InvalidCredentialsError} if credentials are invalid
   */
  login(username: string, password: string): Promise<User>

  /**
   * Update user's password
   * @throws {Error} if validation fails
   * @throws {InvalidCredentialsError} if current password is incorrect
   */
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void>

  /**
   * Update user's email
   * @throws {Error} if validation fails
   */
  updateEmail(userId: string, email: string | null): Promise<void>

  /**
   * Find user by email (hashes email before lookup)
   * @throws {Error} if validation fails
   */
  findByEmail(email: string): Promise<User | null>
}
