export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiKeyError'
  }
}

export class ApiKeyNotFoundError extends ApiKeyError {
  constructor() {
    super('API key not found')
    this.name = 'ApiKeyNotFoundError'
  }
}

export class ApiKeyLimitExceededError extends ApiKeyError {
  constructor() {
    super('Maximum number of API keys (5) reached')
    this.name = 'ApiKeyLimitExceededError'
  }
}

export class InvalidApiKeyError extends ApiKeyError {
  constructor() {
    super('Invalid or expired API key')
    this.name = 'InvalidApiKeyError'
  }
}

export class UnauthorizedApiKeyAccessError extends ApiKeyError {
  constructor(message: string = 'Not authorized to access this API key') {
    super(message)
    this.name = 'UnauthorizedApiKeyAccessError'
  }
}
