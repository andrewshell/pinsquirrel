import type { UserRepository } from '../interfaces/user-repository.js'
import type { PasswordResetRepository } from '../interfaces/password-reset-repository.js'
import type { EmailService } from '../interfaces/email-service.js'
import type { User } from '../entities/user.js'
import {
  InvalidCredentialsError,
  UserAlreadyExistsError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
  TooManyResetRequestsError,
} from '../errors/auth-errors.js'
import {
  hashPassword,
  verifyPassword,
  hashEmail,
  generateSecureToken,
  hashToken,
} from '../server.js'
import {
  usernameSchema,
  passwordSchema,
  emailSchema,
} from '../validation/domain-schemas.js'

export class AuthenticationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetRepository?: PasswordResetRepository,
    private readonly emailService?: EmailService
  ) {}

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

  async requestPasswordReset(
    email: string,
    resetUrl: string
  ): Promise<string | null> {
    // Validate email at service boundary
    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      throw new Error(`Invalid email: ${emailResult.error.issues[0]?.message}`)
    }

    if (!this.passwordResetRepository || !this.emailService) {
      throw new Error('Password reset is not configured')
    }

    // Hash the email to find the user
    const emailHash = hashEmail(email)
    const user = await this.userRepository.findByEmailHash(emailHash)

    // Don't reveal whether the email exists or not for security
    if (!user) {
      return null
    }

    // Check rate limiting - max 3 requests per hour
    const existingTokens = await this.passwordResetRepository.findByUserId(
      user.id
    )
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentTokens = existingTokens.filter(
      token => token.createdAt > oneHourAgo
    )

    if (recentTokens.length >= 3) {
      throw new TooManyResetRequestsError()
    }

    // Delete any existing tokens for this user
    await this.passwordResetRepository.deleteByUserId(user.id)

    // Generate new token
    const token = generateSecureToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now

    // Store the hashed token
    await this.passwordResetRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    // Send the email with the plain token
    await this.emailService.sendPasswordResetEmail(email, token, resetUrl)

    return token
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate password at service boundary
    const passwordResult = passwordSchema.safeParse(newPassword)
    if (!passwordResult.success) {
      throw new Error(
        `Invalid password: ${passwordResult.error.issues[0]?.message}`
      )
    }

    if (!this.passwordResetRepository) {
      throw new Error('Password reset is not configured')
    }

    // Hash the token to find it in the database
    const tokenHash = hashToken(token)
    const resetToken =
      await this.passwordResetRepository.findByTokenHash(tokenHash)

    if (!resetToken) {
      throw new InvalidResetTokenError()
    }

    // Check if token is valid (not expired)
    const isValid = await this.passwordResetRepository.isValidToken(tokenHash)
    if (!isValid) {
      throw new ResetTokenExpiredError()
    }

    // Find the user
    const user = await this.userRepository.findById(resetToken.userId)
    if (!user) {
      throw new InvalidResetTokenError()
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword)

    // Update the user's password
    await this.userRepository.update(user.id, {
      passwordHash,
    })

    // Delete the used token
    await this.passwordResetRepository.delete(resetToken.id)
  }

  async validateResetToken(token: string): Promise<boolean> {
    if (!this.passwordResetRepository) {
      return false
    }

    // Hash the token to find it in the database
    const tokenHash = hashToken(token)
    const resetToken =
      await this.passwordResetRepository.findByTokenHash(tokenHash)

    if (!resetToken) {
      return false
    }

    // Check if token is valid (not expired)
    return await this.passwordResetRepository.isValidToken(tokenHash)
  }
}
