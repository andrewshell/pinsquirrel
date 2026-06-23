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
