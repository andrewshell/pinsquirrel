import type {
  AccessControl,
  UserRepository,
  PasswordResetRepository,
  EmailChangeRepository,
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
  verifyPassword,
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
const VERIFICATION_LINK_LIFETIME_MS = 48 * 60 * 60 * 1000
const UNVERIFIED_HOLD_MS = 7 * 24 * 60 * 60 * 1000
const EMAIL_CHANGE_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000

export interface RegistrationInput {
  username: string
  email: string
  resetUrl?: string
  notifyEmail?: string
  signinUrl?: string
  signupUrl?: string
}

export interface EmailChangeInput {
  userId: string
  email: string
  currentPassword: string
  /** Checked against the stored hash; ignored for an account with no email. */
  currentEmail: string
  confirmUrl: string
}

export interface AccountServiceOptions {
  /**
   * Runs work the caller's response must not wait for or learn the outcome
   * of. The composition root decides how failures are logged.
   */
  defer: (work: () => Promise<void>) => void
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
    private readonly emailChangeRepository: EmailChangeRepository,
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
    const existingUserByUsername = await this.releaseIfStaleUnverified(
      await this.userRepository.findByUsername(input.username)
    )
    const existingUserByEmail = await this.releaseIfStaleUnverified(
      await this.findUserByEmailAndRekey(input.email)
    )

    if (existingUserByEmail) {
      if (!input.signinUrl || !input.resetUrl) return
      const token = await this.issueResetTokenWithinLimit(
        existingUserByEmail.id,
        RESET_LINK_LIFETIME_MS
      )
      if (token) {
        await this.emailService.sendEmailAlreadyRegisteredEmail(
          input.email,
          input.signinUrl,
          token,
          input.resetUrl
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
      const token = await this.issueResetTokenWithinLimit(
        user.id,
        VERIFICATION_LINK_LIFETIME_MS
      )
      if (token) {
        await this.emailService.sendVerificationEmail(
          input.email,
          token,
          input.resetUrl
        )
      }
    }
  }

  /**
   * Ask to move the account to a new address. Nothing changes until the link
   * mailed to the new address is followed (confirmEmailChange).
   *
   * The credentials are checked here, so a wrong password or current address
   * is refused at once. Everything that depends on whether the new address is
   * taken is deferred, so a taken and a free address answer alike: a taken
   * one simply gets no link.
   */
  async requestEmailChange(
    ac: AccessControl,
    input: EmailChangeInput
  ): Promise<void> {
    if (!ac.canUpdate({ userId: input.userId })) {
      throw new UnauthorizedUserAccessError(input.userId)
    }

    const emailResult = emailSchema.safeParse(input.email)
    if (!emailResult.success) {
      throw validationErrorFromZod(emailResult.error, {
        fallbackField: 'email',
      })
    }

    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new InvalidCredentialsError()
    }

    const passwordMatches = await verifyPassword(
      input.currentPassword,
      user.passwordHash
    )
    if (!passwordMatches || !this.isCurrentEmail(user, input.currentEmail)) {
      throw new InvalidCredentialsError()
    }

    if (user.emailHash) {
      this.defer(() =>
        this.emailService.sendEmailChangeNoticeEmail(input.currentEmail)
      )
    }
    this.defer(() => this.offerEmailChange(input))
  }

  private isCurrentEmail(user: User, email: string): boolean {
    if (!user.emailHash) return true
    return (
      user.emailHash === hashEmail(email, this.emailHashKey) ||
      user.emailHash === hashEmail(email)
    )
  }

  private async offerEmailChange(input: EmailChangeInput): Promise<void> {
    if (await this.findUserByEmailAndRekey(input.email)) return

    const token = generateSecureToken()
    await this.emailChangeRepository.save({
      userId: input.userId,
      tokenHash: hashToken(token),
      emailHash: hashEmail(input.email, this.emailHashKey),
      emailEncrypted: this.emailSealer
        ? await this.emailSealer.seal(input.email)
        : null,
      expiresAt: new Date(Date.now() + EMAIL_CHANGE_LINK_LIFETIME_MS),
    })
    await this.emailService.sendEmailChangeConfirmationEmail(
      input.email,
      token,
      input.confirmUrl
    )
  }

  /**
   * Apply the change a confirmation link stands for. False when the link is
   * unknown, used, expired, or its address was taken in the meantime.
   */
  async confirmEmailChange(token: string): Promise<boolean> {
    const change = await this.emailChangeRepository.consume(hashToken(token))
    if (!change) return false

    try {
      const updated = await this.userRepository.update(change.userId, {
        emailHash: change.emailHash,
        emailEncrypted: change.emailEncrypted,
      })
      if (!updated) return false
    } catch (error) {
      if (error instanceof UserAlreadyExistsError) return false
      throw error
    }

    await this.passwordResetRepository.deleteByUserId(change.userId)
    return true
  }

  private async releaseIfStaleUnverified(
    user: User | null
  ): Promise<User | null> {
    if (!user || user.status !== UserStatus.Unverified) return user
    const createdBefore = new Date(Date.now() - UNVERIFIED_HOLD_MS)
    if (user.createdAt >= createdBefore) return user
    const deleted = await this.userRepository.deleteStaleUnverified(
      user.id,
      createdBefore
    )
    return deleted ? null : user
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
    const user = await this.findUserByEmailAndRekey(input.email)
    if (!user) return

    if (this.emailSealer && !user.emailEncrypted) {
      try {
        const emailEncrypted = await this.emailSealer.seal(input.email)
        await this.userRepository.update(user.id, { emailEncrypted })
      } catch {
        // Ignore — the backfill is opportunistic; the reset must still proceed.
      }
    }

    const token = await this.issueResetTokenWithinLimit(
      user.id,
      RESET_LINK_LIFETIME_MS
    )
    if (!token) return

    await this.emailService.sendPasswordResetEmail(
      input.email,
      token,
      input.resetUrl
    )
  }

  private async issueResetTokenWithinLimit(
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

    // A stale unverified account can be deleted between the reads above and
    // this write; its link is then as dead as the account.
    if (!(await this.userRepository.update(user.id, updateData))) {
      throw new InvalidResetTokenError()
    }

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

  private async findUserByEmailAndRekey(email: string): Promise<User | null> {
    const emailHash = hashEmail(email, this.emailHashKey)
    const user = await this.userRepository.findByEmailHash(emailHash)
    if (user || !this.emailHashKey) return user

    const legacy = await this.userRepository.findByEmailHash(hashEmail(email))
    if (!legacy) return null
    await this.userRepository.update(legacy.id, { emailHash })
    return { ...legacy, emailHash }
  }
}
