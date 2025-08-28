import { z } from 'zod'
import { ValidationError } from '@pinsquirrel/domain'
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

// Pin field validation functions
export function validateUrl(url: unknown): string {
  const result = urlSchema.safeParse(url)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validatePinTitle(title: unknown): string {
  const result = pinTitleSchema.safeParse(title)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validatePinDescription(
  description: unknown
): string | null | undefined {
  const result = pinDescriptionSchema.safeParse(description)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validateTagName(tagName: unknown): string {
  const result = tagNameSchema.safeParse(tagName)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validateTagNames(tagNames: unknown): string[] | undefined {
  const result = tagNamesSchema.safeParse(tagNames)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

// Pin creation/update validation
export function validateCreatePinData(data: unknown): {
  url: string
  title: string
  description?: string | null
  readLater?: boolean
  contentPath?: string | null
  imagePath?: string | null
  tagNames?: string[]
} {
  const result = createPinDataSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validateUpdatePinData(data: unknown): {
  url?: string
  title?: string
  description?: string | null
  readLater?: boolean
  contentPath?: string | null
  imagePath?: string | null
  tagNames?: string[]
} {
  const result = updatePinDataSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

// Simple pin creation validation for forms (minimal required fields)
export function validatePinCreation(data: unknown): {
  url: string
  title: string
  description?: string
  readLater?: boolean
} {
  const pinCreationSchema = z.object({
    url: urlSchema,
    title: pinTitleSchema,
    description: z.string().optional(),
    readLater: z.coerce.boolean().optional(),
  })

  const result = pinCreationSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

// Tag validation
export function validateCreateTagData(data: unknown): {
  name: string
} {
  const result = createTagDataSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validateUpdateTagData(data: unknown): {
  name?: string
} {
  const result = updateTagDataSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

// API validation helpers
export function validateIdParam(id: unknown): string {
  const idParamSchema = z.string().uuid('Invalid ID format')
  const result = idParamSchema.safeParse(id)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}

export function validatePagination(data: unknown): {
  page: number
  limit: number
} {
  const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })

  const result = paginationSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  throwValidationError(result.error)
}
