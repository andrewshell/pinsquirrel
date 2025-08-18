import { z } from 'zod'

// URL validation
export const urlSchema = z
  .string()
  .url('Must be a valid URL')
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

export const readLaterSchema = z.boolean().optional().default(false)

// Tag validations
export const tagNameSchema = z
  .string()
  .min(1, 'Tag name must be at least 1 character')
  .max(50, 'Tag name must be at most 50 characters')
  .regex(
    /^[a-zA-Z0-9-]+$/,
    'Tag name can only contain letters, numbers, and hyphens'
  )
  .transform(val => val.toLowerCase())

export const tagNamesSchema = z.array(tagNameSchema).optional()

// Pin creation and update schemas
export const createPinDataSchema = z.object({
  url: urlSchema,
  title: pinTitleSchema,
  description: pinDescriptionSchema,
  readLater: readLaterSchema,
  tagNames: tagNamesSchema,
})

export const updatePinDataSchema = z.object({
  url: urlSchema.optional(),
  title: pinTitleSchema.optional(),
  description: pinDescriptionSchema,
  readLater: readLaterSchema,
  tagNames: tagNamesSchema,
})

// Tag creation and update schemas
export const createTagDataSchema = z.object({
  name: tagNameSchema,
})

export const updateTagDataSchema = z.object({
  name: tagNameSchema.optional(),
})

// Type exports for domain use
export type CreatePinInput = z.infer<typeof createPinDataSchema>
export type UpdatePinInput = z.infer<typeof updatePinDataSchema>
export type CreateTagInput = z.infer<typeof createTagDataSchema>
export type UpdateTagInput = z.infer<typeof updateTagDataSchema>
