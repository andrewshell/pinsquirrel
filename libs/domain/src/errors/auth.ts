export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super('Invalid username or password')
    this.name = 'InvalidCredentialsError'
  }
}

export class UserAlreadyExistsError extends AuthenticationError {
  /**
   * @param username the account being created.
   * @param message overrides the default, which templates `username` in. An
   *   update that collides on email rather than username has no useful
   *   username to name, so it says so instead.
   */
  constructor(
    public readonly username: string,
    message: string = `User with username "${username}" already exists`
  ) {
    super(message)
    this.name = 'UserAlreadyExistsError'
  }
}

export class EmailVerificationRequiredError extends AuthenticationError {
  constructor() {
    super(
      'Please check your email to set your password and complete registration'
    )
    this.name = 'EmailVerificationRequiredError'
  }
}

export class PasswordResetError extends AuthenticationError {
  constructor(message: string) {
    super(message)
    this.name = 'PasswordResetError'
  }
}

export class InvalidResetTokenError extends PasswordResetError {
  constructor() {
    super('Invalid or expired password reset token')
    this.name = 'InvalidResetTokenError'
  }
}

export class ResetTokenExpiredError extends PasswordResetError {
  constructor() {
    super('Password reset token has expired')
    this.name = 'ResetTokenExpiredError'
  }
}

export class TooManyResetRequestsError extends PasswordResetError {
  constructor() {
    super('Too many password reset requests. Please try again later.')
    this.name = 'TooManyResetRequestsError'
  }
}

export class EmailSendError extends PasswordResetError {
  /**
   * @param options carries the provider's own error as `cause`, so a caller
   *   that reports failures per recipient can show what the provider said
   *   rather than this class's wrapping of it.
   */
  constructor(
    message: string = 'Failed to send password reset email',
    options?: { cause?: unknown }
  ) {
    super(message)
    this.name = 'EmailSendError'
    // Assigned rather than passed to super: the AuthenticationError chain
    // takes a message only, and widening it would touch every error in it.
    if (options && 'cause' in options) this.cause = options.cause
  }
}

export class MissingRoleError extends AuthenticationError {
  constructor() {
    super(
      'Your account does not have the required permissions to access this application'
    )
    this.name = 'MissingRoleError'
  }
}

/**
 * Someone tried to claim the first Admin role on a system that already has one.
 *
 * The bootstrap claim is open to any signed-in account precisely because there
 * is no admin yet to authorize it, so "no admin exists" is the whole of its
 * authorization. This is that check failing — a second claimant arriving
 * between the page render and the submit, or a stale tab left open.
 */
export class AdminAlreadyExistsError extends AuthenticationError {
  constructor() {
    super(
      'This system already has an administrator, so admin access cannot be claimed here'
    )
    this.name = 'AdminAlreadyExistsError'
  }
}

export class AccessNotGrantedError extends AuthenticationError {
  constructor() {
    super(
      "You're on the early-access waitlist. We're opening access in batches — please check back soon."
    )
    this.name = 'AccessNotGrantedError'
  }
}
