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
  InvalidResetTokenError,
  ResetTokenExpiredError,
  TooManyResetRequestsError,
  ValidationError,
} from '@pinsquirrel/domain'
import {
  hashPassword,
  hashEmail,
  generateSecureToken,
  hashToken,
} from '../utils/crypto.js'
import {
  emailSchema,
  passwordSchema,
  usernameSchema,
} from '../validation/user.js'
import type { EmailSealer } from './authentication.js'

/**
 * The account lifecycle operations that depend on the email pipeline:
 * registration, email changes, and password recovery.
 *
 * Split out of AuthenticationService so that service could drop to a single
 * required dependency. Everything here needs the reset-token store and a way
 * to send mail; nothing here is reachable without them.
 */
export class AccountService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly emailService: EmailService,
    // Optional by design, unlike the two above: an install that keeps no
    // contactable copy of user emails simply has no key. Every use below
    // stores null rather than failing. Pass a sealer to enable it.
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
    const existingUserByEmail = await this.findUserByEmail(input.email)

    // Handle conflicts without revealing which field conflicted
    if (existingUserByEmail) {
      // Email already registered — notify the email owner privately
      if (input.signinUrl) {
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
      if (input.signupUrl) {
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
      // Hashed here rather than reusing a binding from the duplicate check:
      // this is the stored value, and the lookup above hides its own hashing.
      emailHash: hashEmail(input.email),
      emailEncrypted,
    })

    // Immediately assign User role
    await this.userRepository.addRole(user.id, Role.User)

    // Auto-trigger password reset email for verification if URL provided
    let emailFailed = false
    if (input.resetUrl) {
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
    if (input.notifyEmail) {
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

    const user = await this.findUserByEmail(input.email)

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

  /**
   * The account registered with this address, if any.
   *
   * Emails are never stored in the clear, so every lookup has to go through
   * the same hash. This was written out at each of the three call sites, one
   * of which was a public findByEmail that nothing called.
   *
   * Validation is the caller's business: both callers validate at their own
   * boundary, and register does so well before it gets here.
   */
  private async findUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmailHash(hashEmail(email))
  }
}
