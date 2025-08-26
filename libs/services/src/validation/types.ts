// Generic validation result types that don't depend on any specific validation library

export type ValidationSuccess<T> = {
  success: true
  data: T
}

export type ValidationError = {
  success: false
  errors: FieldErrors
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError

export type FieldErrors = {
  [key: string]: string | string[] | undefined
  _form?: string | string[] // For general form errors
}

// Helper function to create success result
export function createSuccessResult<T>(data: T): ValidationSuccess<T> {
  return {
    success: true,
    data,
  }
}

// Helper function to create error result
export function createErrorResult(errors: FieldErrors): ValidationError {
  return {
    success: false,
    errors,
  }
}

// Helper function to create single field error
export function createFieldError(field: string, message: string): FieldErrors {
  return {
    [field]: message,
  }
}

// Helper function to create form-level error
export function createFormError(message: string): FieldErrors {
  return {
    _form: message,
  }
}
