import { z } from 'zod'

// URL validation
export const urlSchema = z
  .string()
  .url({ message: 'Must be a valid URL' })
  .max(2048, 'URL must be at most 2048 characters')

// Pin field validations
export const pinTitleSchema = z
  .string()
  .min(1, 'Title must be at least 1 character')
  .max(200, 'Title must be at most 200 characters')

export const pinDescriptionSchema = z
  .string()
  .max(1000, 'Description must be at most 1000 characters')
  .nullable()
  .optional()

// Tag validations
export const tagNameSchema = z
  .string()
  .min(1, 'Tag name must be at least 1 character')
  .max(50, 'Tag name must be at most 50 characters')
  .refine(val => val.trim().length > 0, 'Tag name cannot be only whitespace')
  .refine(
    // eslint-disable-next-line no-control-regex
    val => !/[\x00-\x1f\x7f]/.test(val),
    'Tag name cannot contain control characters'
  )
  .transform(val => val.trim().toLowerCase())

// Pin creation and update schemas
export const createPinDataSchema = z.object({
  url: urlSchema,
  title: pinTitleSchema,
  description: pinDescriptionSchema,
  readLater: z.boolean().optional().default(false),
  tagNames: z.array(tagNameSchema).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const updatePinDataSchema = z.object({
  url: urlSchema.optional(),
  title: pinTitleSchema.optional(),
  description: pinDescriptionSchema,
  readLater: z.boolean().optional(),
  tagNames: z.array(tagNameSchema).optional(),
})

// Tag creation and update schemas
export const createTagDataSchema = z.object({
  name: tagNameSchema,
})
