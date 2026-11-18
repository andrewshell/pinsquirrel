import type {
  AccessControl,
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
  UserAlreadyExistsError,
  UnauthorizedUserAccessError,
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
  registrationSchema,
} from '../validation/user.js'
import { validationErrorFromZod } from '../validation/zod-error.js'
import type { EmailSealer } from './authentication.js'

export const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000
const RESET_REQUESTS_PER_WINDOW = 3
const RESET_LINK_LIFETIME_MS = 15 * 60 * 1000

export interface RegistrationInput {
  username: string
  email: string
  resetUrl?: string
  notifyEmail?: string
  signinUrl?: string
  signupUrl?: string
}

export interface AccountServiceOptions {
  /**
   * Runs work the caller's response must not wait for or learn the outcome
   * of. The composition root decides how failures are logged.
   */
  defer: (work: () => Promise<void>) => void
  /**
   * Optional by design: an install that keeps no contactable copy of user
   * emails simply has no key, and every use below stores null instead.
   */
  emailSealer?: EmailSealer
  /** Without it, addresses are stored as their unkeyed SHA-256. */
  emailHashKey?: string
}

/**
 * The account lifecycle operations that depend on the email pipeline:
 * registration, email changes, and password recovery.
 *
 * Split out of AuthenticationService so that service could drop to a single
 * required dependency. Everything here needs the reset-token store and a way
 * to send mail; nothing here is reachable without them.
 *
 * Registration and reset requests validate their input and defer the rest,
 * so whether an address is registered changes neither the answer nor how
 * long it takes, and a mail failure never reaches the caller.
 */
export class AccountService {
  private readonly defer: AccountServiceOptions['defer']
  private readonly emailSealer?: EmailSealer
  private readonly emailHashKey?: string

  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly emailService: EmailService,
    options: AccountServiceOptions
  ) {
    this.defer = options.defer
    this.emailSealer = options.emailSealer
    this.emailHashKey = options.emailHashKey
  }

  register(input: RegistrationInput): void {
    const result = registrationSchema.safeParse(input)
    if (!result.success) {
      throw validationErrorFromZod(result.error)
    }

    this.defer(() => this.completeRegistration(input))
  }

  private async completeRegistration(input: RegistrationInput): Promise<void> {
    const existingUserByUsername = await this.userRepository.findByUsername(
      input.username
    )
    const existingUserByEmail = await this.findUserByEmail(input.email)

    if (existingUserByEmail) {
      if (input.signinUrl) {
        await this.emailService.sendEmailAlreadyRegisteredEmail(
          input.email,
          input.signinUrl
        )
      }
      return
    }

    if (existingUserByUsername) {
      if (input.signupUrl) {
        await this.emailService.sendUsernameTakenEmail(
          input.email,
          input.username,
          input.signupUrl
        )
      }
      return
    }

    const emailEncrypted = this.emailSealer
      ? await this.emailSealer.seal(input.email)
      : null

    let user: User
    try {
      user = await this.userRepository.create({
        username: input.username,
        passwordHash: null,
        emailHash: hashEmail(input.email, this.emailHashKey),
        emailEncrypted,
        roles: [Role.User],
      })
    } catch (error) {
      // Two signups for the same username or email can pass the checks above
      // at the same moment; the unique indexes are what actually stop the
      // second one.
      if (error instanceof UserAlreadyExistsError) return
      throw error
    }

    const { notifyEmail } = input
    if (notifyEmail) {
      this.defer(() =>
        this.emailService.sendSignupNotificationEmail(
          notifyEmail,
          input.username,
          input.email
        )
      )
    }

    if (input.resetUrl) {
      const token = await this.issueResetToken(user.id, RESET_LINK_LIFETIME_MS)
      if (token) {
        await this.emailService.sendPasswordResetEmail(
          input.email,
          token,
          input.resetUrl
        )
      }
    }
  }

  /**
   * Change a user's own email. Only the account holder may do this: the sealed
   * copy is the waitlist's contact address, so letting anyone else rewrite it
   * would redirect that contact.
   */
  async updateEmail(
    ac: AccessControl,
    input: {
      userId: string
      email: string | null
    }
  ): Promise<void> {
    if (!ac.canUpdate({ userId: input.userId })) {
      throw new UnauthorizedUserAccessError(input.userId)
    }

    // Validate email if provided
    if (input.email !== null) {
      const emailResult = emailSchema.safeParse(input.email)
      if (!emailResult.success) {
        throw validationErrorFromZod(emailResult.error, {
          fallbackField: 'email',
        })
      }
    }

    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new InvalidCredentialsError()
    }

    // Hash the email in the business logic layer
    const emailHash = input.email
      ? hashEmail(input.email, this.emailHashKey)
      : null

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

  requestPasswordReset(input: { email: string; resetUrl: string }): void {
    const emailResult = emailSchema.safeParse(input.email)
    if (!emailResult.success) {
      throw validationErrorFromZod(emailResult.error, {
        fallbackField: 'email',
      })
    }

    this.defer(() => this.sendResetLink(input))
  }

  private async sendResetLink(input: {
    email: string
    resetUrl: string
  }): Promise<void> {
    const user = await this.findUserByEmail(input.email)
    if (!user) return

    // Opportunistically backfill the sealed email for users created before
    // sealing existed (their email_encrypted is null). This is one of the few
    // flows where we have the plaintext email for an existing account.
    if (this.emailSealer && !user.emailEncrypted) {
      try {
        const emailEncrypted = await this.emailSealer.seal(input.email)
        await this.userRepository.update(user.id, { emailEncrypted })
      } catch {
        // Ignore — the backfill is opportunistic; the reset must still proceed.
      }
    }

    const token = await this.issueResetToken(user.id, RESET_LINK_LIFETIME_MS)
    if (!token) return

    await this.emailService.sendPasswordResetEmail(
      input.email,
      token,
      input.resetUrl
    )
  }

  /**
   * A new set-password token for the user, or null once the user has had
   * RESET_REQUESTS_PER_WINDOW of them within the window, which bounds the
   * mail any one address can be sent.
   */
  private async issueResetToken(
    userId: string,
    lifetimeMs: number
  ): Promise<string | null> {
    const existingTokens =
      await this.passwordResetRepository.findByUserId(userId)
    const windowStart = new Date(Date.now() - RESET_REQUEST_WINDOW_MS)
    const recentTokens = existingTokens.filter(
      token => token.createdAt > windowStart
    )
    if (recentTokens.length >= RESET_REQUESTS_PER_WINDOW) {
      return null
    }

    const token = generateSecureToken()
    await this.passwordResetRepository.create({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + lifetimeMs),
    })
    return token
  }

  async resetPassword(input: {
    token: string
    newPassword: string
  }): Promise<void> {
    // Validate password at service boundary
    const passwordResult = passwordSchema.safeParse(input.newPassword)
    if (!passwordResult.success) {
      throw validationErrorFromZod(passwordResult.error, {
        fallbackField: 'newPassword',
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

    if (!(await this.passwordResetRepository.consume(resetToken.id))) {
      throw new InvalidResetTokenError()
    }

    // Persist only the fields this operation owns: the new password and, for a
    // brand-new (unverified) account, the verification status transition.
    // Never write username/emailHash from the stale snapshot, and never demote
    // an already-active user resetting a forgotten password.
    const updateData: UpdateUserData = { passwordHash }
    if (user.status === UserStatus.Unverified) {
      updateData.status = UserStatus.Waitlist
    }

    await this.userRepository.update(user.id, updateData)

    await this.passwordResetRepository.deleteByUserId(user.id)
    await this.userRepository.revokeSessionsAndTokens(user.id)
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
   * With a hash key, a row stored before keying is still found under the
   * unkeyed hash and rewritten keyed, since this is one of the few moments the
   * server holds the plaintext address.
   *
   * Validation is the caller's business: every caller validates at its own
   * boundary.
   */
  private async findUserByEmail(email: string): Promise<User | null> {
    const emailHash = hashEmail(email, this.emailHashKey)
    const user = await this.userRepository.findByEmailHash(emailHash)
    if (user || !this.emailHashKey) return user

    const legacy = await this.userRepository.findByEmailHash(hashEmail(email))
    if (!legacy) return null
    await this.userRepository.update(legacy.id, { emailHash })
    return { ...legacy, emailHash }
  }
}
