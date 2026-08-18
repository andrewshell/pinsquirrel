export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}

export class UserNotFoundError extends UserError {
  constructor(identifier?: string) {
    super(identifier ? `User "${identifier}" not found` : 'User not found')
    this.name = 'UserNotFoundError'
  }
}

/**
 * A lifecycle operation was attempted on a user whose current status does not
 * allow it — e.g. granting access to an account that has not confirmed its
 * email yet, which would leave it Active without ever passing through the
 * waitlist.
 */
export class UserNotEligibleError extends UserError {
  constructor(
    public readonly status: string,
    message = `User status "${status}" is not eligible for this action`
  ) {
    super(message)
    this.name = 'UserNotEligibleError'
  }
}
