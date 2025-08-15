// HTTP utilities that are validation-library agnostic
// Uses core validation services instead of direct zod imports

import type { GenericValidationResult, FieldErrors } from '@pinsquirrel/core'

// Re-export types for convenience
export type { GenericValidationResult as ValidationResult, FieldErrors }

// Parse FormData into a plain object
export async function parseFormData(
  request: Request
): Promise<Record<string, string>> {
  try {
    const formData = await request.formData()

    // Convert FormData to a plain object, treating missing fields as empty strings
    const rawData: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        rawData[key] = '' // Files are not supported yet
      } else {
        rawData[key] = String(value)
      }
    }

    return rawData
  } catch {
    return {}
  }
}

// Parse JSON body into unknown data
export async function parseJsonBody(
  request: Request
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return {
        success: false,
        error: 'Content-Type must be application/json',
      }
    }

    const data: unknown = await request.json()
    return {
      success: true,
      data,
    }
  } catch {
    return {
      success: false,
      error: 'Invalid JSON body',
    }
  }
}

// Parse URL search params into a plain object
export function parseSearchParams(url: string | URL): Record<string, string> {
  try {
    const urlObj = typeof url === 'string' ? new URL(url) : url
    return Object.fromEntries(urlObj.searchParams.entries())
  } catch {
    return {}
  }
}

// Parse route params (they're already a plain object)
export function parseParams(
  params: Record<string, string | undefined>
): Record<string, string> {
  const cleanParams: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    cleanParams[key] = value || ''
  }
  return cleanParams
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

// Helper to create data() response with errors for forms
export function createFormErrorResponse(errors: FieldErrors, status = 400) {
  return new Response(JSON.stringify({ errors }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

// Helper to work with validation results in route actions
export function handleValidationResult<T>(
  result: GenericValidationResult<T>,
  onSuccess: (data: T) => Response | Promise<Response>,
  onError?: (errors: FieldErrors) => Response | Promise<Response>
): Response | Promise<Response> {
  if (result.success) {
    return onSuccess(result.data)
  }

  if (onError) {
    return onError(result.errors)
  }

  // Default error response
  return createFormErrorResponse(result.errors)
}
