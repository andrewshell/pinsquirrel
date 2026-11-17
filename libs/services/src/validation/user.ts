import { z } from 'zod'

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores'
  )

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(100, 'Password must be at most 100 characters')

/**
 * A password someone already has, checked against its hash. The length rule
 * above applies only when a password is set; accounts created under an older,
 * shorter rule still have to be able to sign in.
 */
export const existingPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(1024, 'Password must be at most 1024 characters')

export const emailSchema = z
  .email('Invalid email address')
  .max(100, 'Email must be at most 100 characters')

/**
 * Whole-object schemas for the service boundaries that validate more than one
 * field at a time. Parsing the object in one pass (rather than field by field)
 * is what lets those services report every field error at once.
 */
export const credentialsSchema = z.object({
  username: usernameSchema,
  password: existingPasswordSchema,
})

export const registrationSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
})

export const passwordChangeSchema = z.object({
  currentPassword: existingPasswordSchema,
  newPassword: passwordSchema,
})
