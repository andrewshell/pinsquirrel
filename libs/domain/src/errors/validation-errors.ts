export class ValidationError extends Error {
  public readonly fields: Record<string, string[]>

  constructor(fields: Record<string, string[]>, message?: string) {
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

  /**
   * Create a ValidationError with a single field error
   */
  static forField(field: string, message: string): ValidationError {
    return new ValidationError({ [field]: [message] })
  }

  /**
   * Create a ValidationError with multiple field errors
   */
  static forFields(fields: Record<string, string | string[]>): ValidationError {
    const normalizedFields: Record<string, string[]> = {}

    for (const [field, messages] of Object.entries(fields)) {
      normalizedFields[field] = Array.isArray(messages) ? messages : [messages]
    }

    return new ValidationError(normalizedFields)
  }

  /**
   * Add an additional field error
   */
  addFieldError(field: string, message: string): ValidationError {
    const newFields = { ...this.fields }
    newFields[field] = [...(newFields[field] || []), message]
    return new ValidationError(newFields, this.message)
  }

  /**
   * Check if a specific field has errors
   */
  hasFieldError(field: string): boolean {
    return !!(this.fields[field] && this.fields[field].length > 0)
  }

  /**
   * Get errors for a specific field
   */
  getFieldErrors(field: string): string[] {
    return this.fields[field] || []
  }
}
