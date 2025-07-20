import { z } from 'zod'

// Domain validation rules - these define what is valid in the business domain

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
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be at most 100 characters')

export const emailSchema = z
  .string()
  .email({ message: 'Invalid email address' })
  .max(100, 'Email must be at most 100 characters')

// Optional email for situations where email is not required
export const optionalEmailSchema = emailSchema.optional()

// User creation schema - for business logic validation
export const createUserDataSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  email: optionalEmailSchema,
})

// User update schema - for business logic validation
export const updateUserDataSchema = z
  .object({
    email: optionalEmailSchema,
    currentPassword: passwordSchema.optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine(
    data => {
      // If changing password, both fields are required
      if (data.newPassword && !data.currentPassword) {
        return false
      }
      return true
    },
    {
      message: 'Current password is required to change password',
      path: ['currentPassword'],
    }
  )

// Login credentials schema
export const loginCredentialsSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
})

// Type exports for domain use
export type Username = z.infer<typeof usernameSchema>
export type Password = z.infer<typeof passwordSchema>
export type Email = z.infer<typeof emailSchema>
export type CreateUserData = z.infer<typeof createUserDataSchema>
export type UpdateUserData = z.infer<typeof updateUserDataSchema>
export type LoginCredentials = z.infer<typeof loginCredentialsSchema>
