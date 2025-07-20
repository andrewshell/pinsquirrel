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
