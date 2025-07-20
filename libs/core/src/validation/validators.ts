import { z } from 'zod'
import {
  createUserDataSchema,
  updateUserDataSchema,
  loginCredentialsSchema,
  type CreateUserData,
  type UpdateUserData,
  type LoginCredentials,
} from './domain-schemas.js'

// Domain validation result types
export type ValidationSuccess<T> = {
  success: true
  data: T
}

export type ValidationError = {
  success: false
  errors: Record<string, string>
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError

// Convert Zod errors to domain-friendly format
function formatValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root'
    errors[path] = issue.message
  }

  return errors
}

// Domain validation functions
export function validateCreateUserData(
  data: unknown
): ValidationResult<CreateUserData> {
  const result = createUserDataSchema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
    }
  }

  return {
    success: false,
    errors: formatValidationErrors(result.error),
  }
}

export function validateUpdateUserData(
  data: unknown
): ValidationResult<UpdateUserData> {
  const result = updateUserDataSchema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
    }
  }

  return {
    success: false,
    errors: formatValidationErrors(result.error),
  }
}

export function validateLoginCredentials(
  data: unknown
): ValidationResult<LoginCredentials> {
  const result = loginCredentialsSchema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
    }
  }

  return {
    success: false,
    errors: formatValidationErrors(result.error),
  }
}

// Helper to check if a value matches the validation schema
export function isValidUsername(value: string): boolean {
  return createUserDataSchema.shape.username.safeParse(value).success
}

export function isValidPassword(value: string): boolean {
  return createUserDataSchema.shape.password.safeParse(value).success
}

export function isValidEmail(value: string): boolean {
  return createUserDataSchema.shape.email.unwrap().safeParse(value).success
}
