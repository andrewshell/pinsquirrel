import { z } from 'zod'
// Import domain validation from core
import {
  usernameSchema as coreUsernameSchema,
  passwordSchema as corePasswordSchema,
  emailSchema as coreEmailSchema,
  optionalEmailSchema,
  loginCredentialsSchema as coreLoginSchema,
} from '@pinsquirrel/core'

// Re-export core schemas for compatibility
export const usernameSchema = coreUsernameSchema satisfies z.ZodTypeAny
export const passwordSchema = corePasswordSchema satisfies z.ZodTypeAny
export const emailSchema = coreEmailSchema satisfies z.ZodTypeAny

// HTTP-specific schemas extending core validation
export const loginSchema = coreLoginSchema satisfies z.ZodTypeAny

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  email: optionalEmailSchema,
})

// Profile schemas (HTTP-specific, extends core validation)
export const updateEmailSchema = z.object({
  intent: z.literal('update-email'),
  email: emailSchema,
})

export const changePasswordSchema = z.object({
  intent: z.literal('change-password'),
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
})

export const updateProfileSchema = z
  .object({
    email: optionalEmailSchema,
    currentPassword: passwordSchema.optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine(
    (data: {
      email?: string
      currentPassword?: string
      newPassword?: string
    }) => {
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

// API schemas (HTTP-specific)
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
})

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const roleEnum = ['user', 'admin'] as const

export const userCreateSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  email: optionalEmailSchema,
  role: z.enum(roleEnum).default('user'),
}) satisfies z.ZodTypeAny

export const userUpdateSchema = z.object({
  email: optionalEmailSchema,
  role: z.enum(roleEnum).optional(),
}) satisfies z.ZodTypeAny

// Type exports
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
