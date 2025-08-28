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
