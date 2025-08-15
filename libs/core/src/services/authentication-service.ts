import type { UserRepository } from '../interfaces/user-repository.js'
import type { User } from '../entities/user.js'
import {
  InvalidCredentialsError,
  UserAlreadyExistsError,
} from '../errors/auth-errors.js'
import { hashPassword, verifyPassword, hashEmail } from '../server.js'
import {
  usernameSchema,
  passwordSchema,
  emailSchema,
} from '../validation/domain-schemas.js'

export class AuthenticationService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(
    username: string,
    password: string,
    email?: string | null
  ): Promise<User> {
    // Validate inputs at service boundary
    const usernameResult = usernameSchema.safeParse(username)
    if (!usernameResult.success) {
      throw new Error(
        `Invalid username: ${usernameResult.error.issues[0]?.message}`
      )
    }

    const passwordResult = passwordSchema.safeParse(password)
    if (!passwordResult.success) {
      throw new Error(
        `Invalid password: ${passwordResult.error.issues[0]?.message}`
      )
    }

    if (email !== null && email !== undefined) {
      const emailResult = emailSchema.safeParse(email)
      if (!emailResult.success) {
        throw new Error(
          `Invalid email: ${emailResult.error.issues[0]?.message}`
        )
      }
    }

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
    // Validate inputs at service boundary
    const usernameResult = usernameSchema.safeParse(username)
    if (!usernameResult.success) {
      throw new Error(
        `Invalid username: ${usernameResult.error.issues[0]?.message}`
      )
    }

    const passwordResult = passwordSchema.safeParse(password)
    if (!passwordResult.success) {
      throw new Error(
        `Invalid password: ${passwordResult.error.issues[0]?.message}`
      )
    }

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
    // Validate inputs at service boundary
    const currentPasswordResult = passwordSchema.safeParse(currentPassword)
    if (!currentPasswordResult.success) {
      throw new Error(
        `Invalid current password: ${currentPasswordResult.error.issues[0]?.message}`
      )
    }

    const newPasswordResult = passwordSchema.safeParse(newPassword)
    if (!newPasswordResult.success) {
      throw new Error(
        `Invalid new password: ${newPasswordResult.error.issues[0]?.message}`
      )
    }

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
    // Validate email if provided
    if (email !== null) {
      const emailResult = emailSchema.safeParse(email)
      if (!emailResult.success) {
        throw new Error(
          `Invalid email: ${emailResult.error.issues[0]?.message}`
        )
      }
    }

    // Hash the email in the business logic layer
    const emailHash = email ? hashEmail(email) : null

    await this.userRepository.update(userId, {
      emailHash,
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    // Validate email at service boundary
    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      throw new Error(`Invalid email: ${emailResult.error.issues[0]?.message}`)
    }

    // Hash the email in the business logic layer
    const emailHash = hashEmail(email)
    return await this.userRepository.findByEmailHash(emailHash)
  }
}
