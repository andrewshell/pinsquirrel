import type {
  UserRepository,
  PasswordResetRepository,
  EmailService,
  User,
  UpdateUserData,
} from '@pinsquirrel/domain'
import { Role, UserStatus } from '@pinsquirrel/domain'
import {
  InvalidCredentialsError,
  EmailVerificationRequiredError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
  TooManyResetRequestsError,
  ValidationError,
  MissingRoleError,
  AccessNotGrantedError,
  UserNotFoundError,
} from '@pinsquirrel/domain'
import {
  hashPassword,
  verifyPassword,
  getDummyHash,
  hashEmail,
  generateSecureToken,
  hashToken,
} from '../utils/crypto.js'
import {
  usernameSchema,
  passwordSchema,
  emailSchema,
} from '../validation/user.js'

/**
 * Seals an email so the waitlist can be contacted later. Implemented with a
 * public key; the server cannot reverse it (only the offline admin app can).
 */
export interface EmailSealer {
  seal(email: string): Promise<string>
}

export class AuthenticationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetRepository?: PasswordResetRepository,
    private readonly emailService?: EmailService,
    private readonly emailSealer?: EmailSealer
  ) {}

  async register(input: {
    username: string
    email: string
    resetUrl?: string
    notifyEmail?: string
    signinUrl?: string
    signupUrl?: string
  }): Promise<{ emailFailed: boolean }> {
    // Validate inputs at service boundary
    const errors: Record<string, string[]> = {}

    const usernameResult = usernameSchema.safeParse(input.username)
    if (!usernameResult.success) {
      errors.username = [
        usernameResult.error.issues[0]?.message || 'Invalid username',
      ]
    }

    const emailResult = emailSchema.safeParse(input.email)
    if (!emailResult.success) {
      errors.email = [emailResult.error.issues[0]?.message || 'Invalid email']
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
    }

    // Check for existing username and email
    const existingUserByUsername = await this.userRepository.findByUsername(
      input.username
    )
    const emailHash = hashEmail(input.email)
    const existingUserByEmail =
      await this.userRepository.findByEmailHash(emailHash)

    // Handle conflicts without revealing which field conflicted
    if (existingUserByEmail) {
      // Email already registered — notify the email owner privately
      if (this.emailService && input.signinUrl) {
        try {
          await this.emailService.sendEmailAlreadyRegisteredEmail(
            input.email,
            input.signinUrl
          )
        } catch {
          // Don't fail if notification email fails
        }
      }
      return { emailFailed: false }
    }

    if (existingUserByUsername) {
      // Username taken — notify the provided email privately
      if (this.emailService && input.signupUrl) {
        try {
          await this.emailService.sendUsernameTakenEmail(
            input.email,
            input.username,
            input.signupUrl
          )
        } catch {
          // Don't fail if notification email fails
        }
      }
      return { emailFailed: false }
    }

    // Seal the email (if a public key is configured) so the waitlist can be
    // contacted later. The server cannot decrypt this.
    const emailEncrypted = this.emailSealer
      ? await this.emailSealer.seal(input.email)
      : null

    // Create user without password (they'll set it via email verification)
    const user = await this.userRepository.create({
      username: input.username,
      passwordHash: null, // No password yet - they'll set it via email verification
      emailHash,
      emailEncrypted,
    })

    // Immediately assign User role
    await this.userRepository.addRole(user.id, Role.User)

    // Auto-trigger password reset email for verification if URL provided
    let emailFailed = false
    if (input.resetUrl && this.passwordResetRepository && this.emailService) {
      try {
        await this.requestPasswordReset({
          email: input.email,
          resetUrl: input.resetUrl,
        })
      } catch {
        emailFailed = true
      }
    }

    // Send signup notification email if notifyEmail is provided
    if (input.notifyEmail && this.emailService) {
      try {
        await this.emailService.sendSignupNotificationEmail(
          input.notifyEmail,
          input.username,
          input.email
        )
      } catch {
        // Don't fail registration if notification email fails
      }
    }

    return { emailFailed }
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
    const passwordHash = user?.passwordHash ?? getDummyHash()
    const isValidPassword = await verifyPassword(input.password, passwordHash)

    if (!user || !user.passwordHash || !isValidPassword) {
      throw new InvalidCredentialsError()
    }

    // Check if user has the User role
    if (!user.roles.includes(Role.User)) {
      throw new MissingRoleError()
    }

    // Only users who have been granted access can sign in. Verified accounts
    // awaiting an access grant are still on the early-access waitlist.
    if (user.status !== UserStatus.Active) {
      throw new AccessNotGrantedError()
    }

    return user
  }

  /**
   * Grant a user access to the application, moving them off the early-access
   * waitlist and into the active state. Idempotent: granting an already-active
   * user is a no-op. Intended for manual/admin use.
   */
  async grantAccess(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundError(userId)
    }

    if (user.status === UserStatus.Active) {
      return user
    }

    const updated = await this.userRepository.update(userId, {
      status: UserStatus.Active,
    })
    if (!updated) {
      throw new UserNotFoundError(userId)
    }

    return updated
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

    // Check if user has completed email verification (set password)
    if (!user.passwordHash) {
      throw new EmailVerificationRequiredError()
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

    // Persist only the field this operation owns to avoid clobbering a
    // concurrent username/email change made after the findById read.
    await this.userRepository.update(input.userId, { passwordHash })
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

    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new InvalidCredentialsError()
    }

    // Hash the email in the business logic layer
    const emailHash = input.email ? hashEmail(input.email) : null

    // Re-seal the email (or clear it) to keep the contactable copy in sync
    const emailEncrypted =
      input.email && this.emailSealer
        ? await this.emailSealer.seal(input.email)
        : null

    // Persist only the fields this operation owns. Writing username/passwordHash
    // from the stale findById snapshot could clobber a concurrent change.
    await this.userRepository.update(input.userId, {
      emailHash,
      emailEncrypted,
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

    // Opportunistically backfill the sealed email for users created before
    // sealing existed (their email_encrypted is null). This is the one flow
    // where we have the plaintext email for an existing account. Best-effort:
    // a sealing or write failure must never abort the password reset itself.
    if (this.emailSealer && !user.emailEncrypted) {
      try {
        const emailEncrypted = await this.emailSealer.seal(input.email)
        await this.userRepository.update(user.id, { emailEncrypted })
      } catch {
        // Ignore — the backfill is opportunistic; the reset must still proceed.
      }
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

    // Persist only the fields this operation owns: the new password and, for a
    // brand-new (unverified) account, the verification status transition.
    // Never write username/emailHash from the stale snapshot, and never demote
    // an already-active user resetting a forgotten password.
    const updateData: UpdateUserData = { passwordHash }
    if (user.status === UserStatus.Unverified) {
      updateData.status = UserStatus.Waitlist
    }

    await this.userRepository.update(user.id, updateData)

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
