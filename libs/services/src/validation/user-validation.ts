import { z } from 'zod'
import { ValidationError } from '@pinsquirrel/domain'
import {
  usernameSchema,
  passwordSchema,
  emailSchema,
  optionalEmailSchema,
  createUserDataSchema,
  updateUserDataSchema,
  loginCredentialsSchema,
} from './domain-schemas.js'

// Convert zod errors to ValidationError
function throwValidationError(error: z.ZodError): never {
  const fields: Record<string, string[]> = {}

  if (!error || !error.issues) {
    throw new ValidationError({ _form: ['Invalid form data'] })
  }

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_form'

    if (!fields[path]) {
      fields[path] = []
    }
    fields[path].push(issue.message)
  }

  throw new ValidationError(fields)
}

// User validation functions that return validated data or throw ValidationError
export function validateUsername(username: unknown): string {
  const result = usernameSchema.safeParse(username)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validatePassword(password: unknown): string {
  const result = passwordSchema.safeParse(password)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validateEmail(email: unknown): string {
  const result = emailSchema.safeParse(email)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validateOptionalEmail(email: unknown): string | undefined {
  const result = optionalEmailSchema.safeParse(email)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validateCreateUserData(data: unknown): {
  username: string
  password: string
  email?: string
} {
  const result = createUserDataSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validateUpdateUserData(data: unknown): {
  email?: string
  currentPassword?: string
  newPassword?: string
} {
  const result = updateUserDataSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validateLoginCredentials(data: unknown): {
  username: string
  password: string
  keepSignedIn: boolean
} {
  const result = loginCredentialsSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

// Additional validation functions for web forms
export function validateRegistration(data: unknown): {
  username: string
  password: string
  email?: string
} {
  return validateCreateUserData(data)
}

export function validateLogin(data: unknown): {
  username: string
  password: string
  keepSignedIn: boolean
} {
  return validateLoginCredentials(data)
}

export function validateEmailUpdate(data: unknown): {
  intent: 'update-email'
  email: string
} {
  const emailUpdateSchema = z.object({
    intent: z.literal('update-email'),
    email: emailSchema,
  })

  const result = emailUpdateSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validatePasswordChange(data: unknown): {
  intent: 'change-password'
  currentPassword: string
  newPassword: string
} {
  const passwordChangeSchema = z.object({
    intent: z.literal('change-password'),
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  })

  const result = passwordChangeSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}
