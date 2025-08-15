import { z } from 'zod'
import {
  usernameSchema,
  passwordSchema,
  emailSchema,
  optionalEmailSchema,
  createUserDataSchema,
  updateUserDataSchema,
  loginCredentialsSchema,
} from './domain-schemas.js'
import type { ValidationResult, FieldErrors } from './types.js'
import { createSuccessResult, createErrorResult } from './types.js'

// Convert zod errors to our generic field errors
function formatZodErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {}

  if (!error || !error.issues) {
    return { _form: 'Invalid form data' }
  }

  for (const issue of error.issues) {
    const path = issue.path.join('.')

    if (path === '') {
      // Root level error
      if (!fieldErrors._form) {
        fieldErrors._form = []
      }
      if (Array.isArray(fieldErrors._form)) {
        fieldErrors._form.push(issue.message)
      }
    } else {
      // Field level error
      if (!fieldErrors[path]) {
        fieldErrors[path] = []
      }
      if (Array.isArray(fieldErrors[path])) {
        ;(fieldErrors[path] as string[]).push(issue.message)
      }
    }
  }

  // Convert single error arrays to strings
  for (const key in fieldErrors) {
    const value = fieldErrors[key]
    if (Array.isArray(value) && value.length === 1) {
      fieldErrors[key] = value[0]
    }
  }

  return fieldErrors
}

// User validation functions that return generic results
export function validateUsername(username: unknown): ValidationResult<string> {
  const result = usernameSchema.safeParse(username)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validatePassword(password: unknown): ValidationResult<string> {
  const result = passwordSchema.safeParse(password)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validateEmail(email: unknown): ValidationResult<string> {
  const result = emailSchema.safeParse(email)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validateOptionalEmail(
  email: unknown
): ValidationResult<string | undefined> {
  const result = optionalEmailSchema.safeParse(email)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validateCreateUserData(data: unknown): ValidationResult<{
  username: string
  password: string
  email?: string
}> {
  const result = createUserDataSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validateUpdateUserData(data: unknown): ValidationResult<{
  email?: string
  currentPassword?: string
  newPassword?: string
}> {
  const result = updateUserDataSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validateLoginCredentials(data: unknown): ValidationResult<{
  username: string
  password: string
}> {
  const result = loginCredentialsSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

// Additional validation functions for web forms
export function validateRegistration(data: unknown): ValidationResult<{
  username: string
  password: string
  email?: string
}> {
  return validateCreateUserData(data)
}

export function validateLogin(data: unknown): ValidationResult<{
  username: string
  password: string
}> {
  return validateLoginCredentials(data)
}

export function validateEmailUpdate(data: unknown): ValidationResult<{
  intent: 'update-email'
  email: string
}> {
  const emailUpdateSchema = z.object({
    intent: z.literal('update-email'),
    email: emailSchema,
  })

  const result = emailUpdateSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validatePasswordChange(data: unknown): ValidationResult<{
  intent: 'change-password'
  currentPassword: string
  newPassword: string
}> {
  const passwordChangeSchema = z.object({
    intent: z.literal('change-password'),
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  })

  const result = passwordChangeSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}
