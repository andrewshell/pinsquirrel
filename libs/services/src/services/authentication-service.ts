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
} from '../validation/domain-schemas.js'

export class AuthenticationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetRepository?: PasswordResetRepository,
    private readonly emailService?: EmailService
  ) {}

  /**
   * Register a new user from raw form data
   */
  async registerFromFormData(formData: Record<string, unknown>): Promise<User> {
    // Validate required fields
    const errors: Record<string, string[]> = {}

    const username = formData.username
    if (!username || typeof username !== 'string') {
      errors.username = ['Username is required']
    }

    const password = formData.password
    if (!password || typeof password !== 'string') {
      errors.password = ['Password is required']
    }

    const email = formData.email
    if (email !== undefined && email !== null && typeof email !== 'string') {
      errors.email = ['Email must be a valid string']
    }

    // Validate username format
    if (username && typeof username === 'string') {
      const usernameResult = usernameSchema.safeParse(username)
      if (!usernameResult.success) {
        errors.username = errors.username || []
        errors.username.push(
          usernameResult.error.issues[0]?.message || 'Invalid username'
        )
      }
    }

    // Validate password format
    if (password && typeof password === 'string') {
      const passwordResult = passwordSchema.safeParse(password)
      if (!passwordResult.success) {
        errors.password = errors.password || []
        errors.password.push(
          passwordResult.error.issues[0]?.message || 'Invalid password'
        )
      }
    }

    // Validate email format if provided (treat empty string as undefined)
    if (email && typeof email === 'string' && email.trim() !== '') {
      const emailResult = emailSchema.safeParse(email)
      if (!emailResult.success) {
        errors.email = errors.email || []
        errors.email.push(
          emailResult.error.issues[0]?.message || 'Invalid email'
        )
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
    }

    return this.register(
      username as string,
      password as string,
      email && typeof email === 'string' && email.trim() !== ''
        ? email
        : undefined
    )
  }

  /**
   * Login user from raw form data
   */
  async loginFromFormData(formData: Record<string, unknown>): Promise<User> {
    // Validate required fields
    const errors: Record<string, string[]> = {}

    const username = formData.username
    if (!username || typeof username !== 'string') {
      errors.username = ['Username is required']
    }

    const password = formData.password
    if (!password || typeof password !== 'string') {
      errors.password = ['Password is required']
    }

    // Validate username format
    if (username && typeof username === 'string') {
      const usernameResult = usernameSchema.safeParse(username)
      if (!usernameResult.success) {
        errors.username = errors.username || []
        errors.username.push(
          usernameResult.error.issues[0]?.message || 'Invalid username'
        )
      }
    }

    // Validate password format
    if (password && typeof password === 'string') {
      const passwordResult = passwordSchema.safeParse(password)
      if (!passwordResult.success) {
        errors.password = errors.password || []
        errors.password.push(
          passwordResult.error.issues[0]?.message || 'Invalid password'
        )
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
    }

    return this.login(username as string, password as string)
  }

  /**
   * Change password from raw form data
   */
  async changePasswordFromFormData(
    userId: string,
    formData: Record<string, unknown>
  ): Promise<void> {
    // Validate required fields
    const errors: Record<string, string[]> = {}

    const currentPassword = formData.currentPassword
    if (!currentPassword || typeof currentPassword !== 'string') {
      errors.currentPassword = ['Current password is required']
    }

    const newPassword = formData.newPassword
    if (!newPassword || typeof newPassword !== 'string') {
      errors.newPassword = ['New password is required']
    }

    // Validate current password format
    if (currentPassword && typeof currentPassword === 'string') {
      const passwordResult = passwordSchema.safeParse(currentPassword)
      if (!passwordResult.success) {
        errors.currentPassword = errors.currentPassword || []
        errors.currentPassword.push(
          passwordResult.error.issues[0]?.message || 'Invalid password'
        )
      }
    }

    // Validate new password format
    if (newPassword && typeof newPassword === 'string') {
      const passwordResult = passwordSchema.safeParse(newPassword)
      if (!passwordResult.success) {
        errors.newPassword = errors.newPassword || []
        errors.newPassword.push(
          passwordResult.error.issues[0]?.message || 'Invalid password'
        )
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
    }

    return this.changePassword(
      userId,
      currentPassword as string,
      newPassword as string
    )
  }

  /**
   * Update email from raw form data
   */
  async updateEmailFromFormData(
    userId: string,
    formData: Record<string, unknown>
  ): Promise<void> {
    const email = formData.email

    // Allow null/empty email
    if (email === '' || email === null || email === undefined) {
      return this.updateEmail(userId, null)
    }

    if (typeof email !== 'string') {
      throw ValidationError.forField('email', 'Email must be a valid string')
    }

    // Validate email format
    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      throw ValidationError.forField(
        'email',
        emailResult.error.issues[0]?.message || 'Invalid email'
      )
    }

    return this.updateEmail(userId, email)
  }

  async register(
    username: string,
    password: string,
    email?: string | null
  ): Promise<User> {
    // Validate inputs at service boundary
    const errors: Record<string, string[]> = {}

    const usernameResult = usernameSchema.safeParse(username)
    if (!usernameResult.success) {
      errors.username = [
        usernameResult.error.issues[0]?.message || 'Invalid username',
      ]
    }

    const passwordResult = passwordSchema.safeParse(password)
    if (!passwordResult.success) {
      errors.password = [
        passwordResult.error.issues[0]?.message || 'Invalid password',
      ]
    }

    if (email !== null && email !== undefined && email.trim() !== '') {
      const emailResult = emailSchema.safeParse(email)
      if (!emailResult.success) {
        errors.email = [emailResult.error.issues[0]?.message || 'Invalid email']
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
    }

    // Check if username already exists
    const existingUser = await this.userRepository.findByUsername(username)
    if (existingUser) {
      throw new UserAlreadyExistsError(username)
    }

    // Hash password and email in the business logic layer
    const passwordHash = await hashPassword(password)
    const emailHash = email && email.trim() !== '' ? hashEmail(email) : null

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
    const errors: Record<string, string[]> = {}

    const usernameResult = usernameSchema.safeParse(username)
    if (!usernameResult.success) {
      errors.username = [
        usernameResult.error.issues[0]?.message || 'Invalid username',
      ]
    }

    const passwordResult = passwordSchema.safeParse(password)
    if (!passwordResult.success) {
      errors.password = [
        passwordResult.error.issues[0]?.message || 'Invalid password',
      ]
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
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
    const errors: Record<string, string[]> = {}

    const currentPasswordResult = passwordSchema.safeParse(currentPassword)
    if (!currentPasswordResult.success) {
      errors.currentPassword = [
        currentPasswordResult.error.issues[0]?.message || 'Invalid password',
      ]
    }

    const newPasswordResult = passwordSchema.safeParse(newPassword)
    if (!newPasswordResult.success) {
      errors.newPassword = [
        newPasswordResult.error.issues[0]?.message || 'Invalid password',
      ]
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
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
        throw ValidationError.forField(
          'email',
          emailResult.error.issues[0]?.message || 'Invalid email'
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
      throw ValidationError.forField(
        'email',
        emailResult.error.issues[0]?.message || 'Invalid email'
      )
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
      throw ValidationError.forField(
        'email',
        emailResult.error.issues[0]?.message || 'Invalid email'
      )
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
      throw ValidationError.forField(
        'newPassword',
        passwordResult.error.issues[0]?.message || 'Invalid password'
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
