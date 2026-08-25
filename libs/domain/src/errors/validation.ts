export type FieldErrors = Record<string, string[]>

export class ValidationError extends Error {
  public readonly fields: FieldErrors

  constructor(fields: FieldErrors, message?: string) {
    // If no custom message provided, use the first field error as the message
    let errorMessage = message
    if (!errorMessage) {
      const fieldErrors = Object.entries(fields)
      if (fieldErrors.length > 0) {
        const [, messages] = fieldErrors[0]
        errorMessage = messages[0] || 'Validation failed'
      } else {
        errorMessage = 'Validation failed'
      }
    }

    super(errorMessage)
    this.name = 'ValidationError'
    this.fields = fields
  }
}
