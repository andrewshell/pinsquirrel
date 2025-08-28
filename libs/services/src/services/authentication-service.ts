import type {
  UserRepository,
  PasswordResetRepository,
  EmailService,
  User,
} from '@pinsquirrel/domain'
import {
  InvalidCredentialsError,
  UserAlreadyExistsError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
  TooManyResetRequestsError,
  ValidationError,
} from '@pinsquirrel/domain'
import {
  hashPassword,
  verifyPassword,
  hashEmail,
  generateSecureToken,
  hashToken,
} from '../utils/crypto.js'
import {
  usernameSchema,
  passwordSchema,
  emailSchema,
} from '../validation/user.js'

export class AuthenticationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetRepository?: PasswordResetRepository,
    private readonly emailService?: EmailService
  ) {}

  async register(input: {
    username: string
    password: string
    email?: string | null
  }): Promise<User> {
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

    if (
      input.email !== null &&
      input.email !== undefined &&
      input.email.trim() !== ''
    ) {
      const emailResult = emailSchema.safeParse(input.email)
      if (!emailResult.success) {
        errors.email = [emailResult.error.issues[0]?.message || 'Invalid email']
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
    }

    // Check if username already exists
    const existingUser = await this.userRepository.findByUsername(
      input.username
    )
    if (existingUser) {
      throw new UserAlreadyExistsError(input.username)
    }

    // Hash password and email in the business logic layer
    const passwordHash = await hashPassword(input.password)
    const emailHash =
      input.email && input.email.trim() !== '' ? hashEmail(input.email) : null

    // Create user with already hashed data
    const user = await this.userRepository.create({
      username: input.username,
      passwordHash,
      emailHash,
    })

    return user
  }

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
    if (!user) {
      throw new InvalidCredentialsError()
    }

    const isValidPassword = await verifyPassword(
      input.password,
      user.passwordHash
    )
    if (!isValidPassword) {
      throw new InvalidCredentialsError()
    }

    return user
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

    const isValidPassword = await verifyPassword(
      input.currentPassword,
      user.passwordHash
    )
    if (!isValidPassword) {
      throw new InvalidCredentialsError()
    }

    // Hash the new password in the business logic layer
    const passwordHash = await hashPassword(input.newPassword)

    await this.userRepository.update(input.userId, {
      passwordHash,
    })
  }

  async updateEmail(input: {
    userId: string
    email: string | null
  }): Promise<void> {
    // Validate email if provided
    if (input.email !== null) {
      const emailResult = emailSchema.safeParse(input.email)
      if (!emailResult.success) {
        throw new ValidationError({
          email: [emailResult.error.issues[0]?.message || 'Invalid email'],
        })
      }
    }

    // Hash the email in the business logic layer
    const emailHash = input.email ? hashEmail(input.email) : null

    await this.userRepository.update(input.userId, {
      emailHash,
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    // Validate email at service boundary
    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      throw new ValidationError({
        email: [emailResult.error.issues[0]?.message || 'Invalid email'],
      })
    }

    // Hash the email in the business logic layer
    const emailHash = hashEmail(email)
    return await this.userRepository.findByEmailHash(emailHash)
  }

  async requestPasswordReset(input: {
    email: string
    resetUrl: string
  }): Promise<string | null> {
    // Validate email at service boundary
    const emailResult = emailSchema.safeParse(input.email)
    if (!emailResult.success) {
      throw new ValidationError({
        email: [emailResult.error.issues[0]?.message || 'Invalid email'],
      })
    }

    if (!this.passwordResetRepository || !this.emailService) {
      throw new Error('Password reset is not configured')
    }

    // Hash the email to find the user
    const emailHash = hashEmail(input.email)
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
    await this.emailService.sendPasswordResetEmail(
      input.email,
      token,
      input.resetUrl
    )

    return token
  }

  async resetPassword(input: {
    token: string
    newPassword: string
  }): Promise<void> {
    // Validate password at service boundary
    const passwordResult = passwordSchema.safeParse(input.newPassword)
    if (!passwordResult.success) {
      throw new ValidationError({
        newPassword: [
          passwordResult.error.issues[0]?.message || 'Invalid password',
        ],
      })
    }

    if (!this.passwordResetRepository) {
      throw new Error('Password reset is not configured')
    }

    // Hash the token to find it in the database
    const tokenHash = hashToken(input.token)
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
    const passwordHash = await hashPassword(input.newPassword)

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
