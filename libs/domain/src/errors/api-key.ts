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

export class UnauthorizedApiKeyAccessError extends ApiKeyError {
  /**
   * Same shape as the pin and tag errors: an id first, an optional message
   * second. Pass `''` for the id when the refusal is about the caller rather
   * than one key.
   */
  constructor(
    public readonly apiKeyId: string,
    message: string = `Not authorized to access API key "${apiKeyId}"`
  ) {
    super(message)
    this.name = 'UnauthorizedApiKeyAccessError'
  }
}
