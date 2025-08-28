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
  .email('Invalid email address')
  .max(100, 'Email must be at most 100 characters')
