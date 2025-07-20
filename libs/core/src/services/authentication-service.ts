import type { AuthenticationService } from '../interfaces/authentication-service.js'
import type { UserRepository } from '../interfaces/user-repository.js'
import type { User } from '../entities/user.js'
import {
  InvalidCredentialsError,
  UserAlreadyExistsError,
} from '../errors/auth-errors.js'
import { hashPassword, verifyPassword, hashEmail } from '../utils/crypto.js'

export class AuthenticationServiceImpl implements AuthenticationService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(
    username: string,
    password: string,
    email?: string
  ): Promise<User> {
    // Check if username already exists
    const existingUser = await this.userRepository.findByUsername(username)
    if (existingUser) {
      throw new UserAlreadyExistsError(username)
    }

    // Hash password and email in the business logic layer
    const passwordHash = await hashPassword(password)
    const emailHash = email ? hashEmail(email) : null

    // Create user with already hashed data
    const user = await this.userRepository.create({
      username,
      passwordHash,
      emailHash,
    })

    return user
  }

  async login(username: string, password: string): Promise<User> {
    const user = await this.userRepository.findByUsername(username)
    if (!user) {
      throw new InvalidCredentialsError()
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      throw new InvalidCredentialsError()
    }

    return user
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new InvalidCredentialsError()
    }

    const isValidPassword = await verifyPassword(
      currentPassword,
      user.passwordHash
    )
    if (!isValidPassword) {
      throw new InvalidCredentialsError()
    }

    // Hash the new password in the business logic layer
    const passwordHash = await hashPassword(newPassword)

    await this.userRepository.update(userId, {
      passwordHash,
    })
  }

  async updateEmail(userId: string, email: string | null): Promise<void> {
    // Hash the email in the business logic layer
    const emailHash = email ? hashEmail(email) : null

    await this.userRepository.update(userId, {
      emailHash,
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    // Hash the email in the business logic layer
    const emailHash = hashEmail(email)
    return await this.userRepository.findByEmailHash(emailHash)
  }
}
