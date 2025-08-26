// Web-specific error handling types and utilities
// Bridges between domain errors and form display needs

export type FieldErrors = {
  [key: string]: string | string[] | undefined
  _form?: string | string[] // For general form errors
}

export type FormErrors =
  | Record<string, string[]>
  | { _form: string }
  | { [key: string]: string[] }

/**
 * Convert ValidationError fields to web form error format
 */
export function convertValidationErrorToFormErrors(
  fields: Record<string, string[]>
): FieldErrors {
  return fields
}

/**
 * Create a general form error
 */
export function createFormError(message: string): FieldErrors {
  return {
    _form: message,
  }
}

/**
 * Create a field-specific error
 */
export function createFieldError(field: string, message: string): FieldErrors {
  return {
    [field]: message,
  }
}
