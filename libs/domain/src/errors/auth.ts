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
  constructor(username: string) {
    super(`User with username "${username}" already exists`)
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

export class ResetTokenNotFoundError extends PasswordResetError {
  constructor() {
    super('Password reset token not found')
    this.name = 'ResetTokenNotFoundError'
  }
}

export class TooManyResetRequestsError extends PasswordResetError {
  constructor() {
    super('Too many password reset requests. Please try again later.')
    this.name = 'TooManyResetRequestsError'
  }
}

export class EmailSendError extends PasswordResetError {
  constructor(message: string = 'Failed to send password reset email') {
    super(message)
    this.name = 'EmailSendError'
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
