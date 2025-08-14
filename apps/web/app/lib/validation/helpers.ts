import { z } from 'zod'

// Result types
export type ValidationSuccess<T> = {
  success: true
  data: T
}

export type ValidationError = {
  success: false
  errors: FieldErrors
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError

export type FieldErrors = {
  [key: string]: string | string[] | undefined
  _form?: string | string[] // For general form errors
}

// Convert Zod errors to field errors
export function formatZodErrors(error: z.ZodError): FieldErrors {
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
        fieldErrors[path].push(issue.message)
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

// Parse and validate FormData
export async function parseFormData<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const formData = await request.formData()

    // Convert FormData to a plain object, treating missing fields as empty strings
    const rawData: Record<string, unknown> = {}
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        rawData[key] = '' // Files are not supported yet
      } else {
        rawData[key] = String(value)
      }
    }

    // For missing optional fields, we don't need to set them since Zod handles undefined for optional fields
    // For required string fields that are missing, Zod will give appropriate error messages

    const result = schema.safeParse(rawData)

    if (result.success) {
      return {
        success: true,
        data: result.data,
      }
    }

    return {
      success: false,
      errors: formatZodErrors(result.error),
    }
  } catch {
    return {
      success: false,
      errors: {
        _form: ['Invalid form data'],
      },
    }
  }
}

// Parse and validate JSON body
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return {
        success: false,
        errors: {
          _form: ['Content-Type must be application/json'],
        },
      }
    }

    const data: unknown = await request.json()
    const result = schema.safeParse(data)

    if (result.success) {
      return {
        success: true,
        data: result.data,
      }
    }

    return {
      success: false,
      errors: formatZodErrors(result.error),
    }
  } catch {
    return {
      success: false,
      errors: {
        _form: ['Invalid JSON body'],
      },
    }
  }
}

// Parse and validate URL search params
export function parseSearchParams<T>(
  url: string | URL,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  try {
    const urlObj = typeof url === 'string' ? new URL(url) : url
    const params = Object.fromEntries(urlObj.searchParams.entries())

    const result = schema.safeParse(params)

    if (result.success) {
      return {
        success: true,
        data: result.data,
      }
    }

    return {
      success: false,
      errors: formatZodErrors(result.error),
    }
  } catch {
    return {
      success: false,
      errors: {
        _form: ['Invalid URL parameters'],
      },
    }
  }
}

// Parse and validate route params
export function parseParams<T>(
  params: Record<string, string | undefined>,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  const result = schema.safeParse(params)

  if (result.success) {
    return {
      success: true,
      data: result.data,
    }
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  }
}

// Helper to create error response for API routes
export function validationErrorResponse(errors: FieldErrors, status = 400) {
  return new Response(
    JSON.stringify({
      success: false,
      errors,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

// Helper to create success response for API routes
export function successResponse<T>(data: T, status = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}
