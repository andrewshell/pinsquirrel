import { z } from 'zod'
import {
  urlSchema,
  pinTitleSchema,
  pinDescriptionSchema,
  tagNameSchema,
  tagNamesSchema,
  createPinDataSchema,
  updatePinDataSchema,
  createTagDataSchema,
  updateTagDataSchema,
} from './pin-schemas.js'
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

// Pin field validation functions
export function validateUrl(url: unknown): ValidationResult<string> {
  const result = urlSchema.safeParse(url)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validatePinTitle(title: unknown): ValidationResult<string> {
  const result = pinTitleSchema.safeParse(title)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validatePinDescription(
  description: unknown
): ValidationResult<string | null | undefined> {
  const result = pinDescriptionSchema.safeParse(description)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validateTagName(tagName: unknown): ValidationResult<string> {
  const result = tagNameSchema.safeParse(tagName)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validateTagNames(
  tagNames: unknown
): ValidationResult<string[] | undefined> {
  const result = tagNamesSchema.safeParse(tagNames)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

// Pin creation/update validation
export function validateCreatePinData(data: unknown): ValidationResult<{
  url: string
  title: string
  description?: string | null
  readLater?: boolean
  contentPath?: string | null
  imagePath?: string | null
  tagNames?: string[]
}> {
  const result = createPinDataSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validateUpdatePinData(data: unknown): ValidationResult<{
  url?: string
  title?: string
  description?: string | null
  readLater?: boolean
  contentPath?: string | null
  imagePath?: string | null
  tagNames?: string[]
}> {
  const result = updatePinDataSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

// Simple pin creation validation for forms (minimal required fields)
export function validatePinCreation(data: unknown): ValidationResult<{
  url: string
  title: string
  description?: string
}> {
  const pinCreationSchema = z.object({
    url: urlSchema,
    title: pinTitleSchema,
    description: z.string().optional(),
  })

  const result = pinCreationSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

// Tag validation
export function validateCreateTagData(data: unknown): ValidationResult<{
  name: string
}> {
  const result = createTagDataSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validateUpdateTagData(data: unknown): ValidationResult<{
  name?: string
}> {
  const result = updateTagDataSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

// API validation helpers
export function validateIdParam(id: unknown): ValidationResult<string> {
  const idParamSchema = z.string().uuid('Invalid ID format')
  const result = idParamSchema.safeParse(id)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}

export function validatePagination(data: unknown): ValidationResult<{
  page: number
  limit: number
}> {
  const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })

  const result = paginationSchema.safeParse(data)

  if (result.success) {
    return createSuccessResult(result.data)
  }

  return createErrorResult(formatZodErrors(result.error))
}
