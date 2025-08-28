// HTTP utilities for form data parsing

import type { ValidationError } from '@pinsquirrel/domain'

// Parse FormData into a plain object with proper type handling
export async function parseFormData(
  request: Request
): Promise<Record<string, string | string[] | boolean>> {
  try {
    const formData = await request.formData()

    // Get all keys to handle multiple values properly
    const keys = Array.from(new Set(formData.keys()))
    const rawData: Record<string, string | string[] | boolean> = {}

    for (const key of keys) {
      const allValues = formData.getAll(key)

      // Handle files by converting to empty string
      const stringValues = allValues.map(value =>
        value instanceof File ? '' : String(value)
      )

      // Special handling for boolean fields (checkboxes)
      if (key === 'readLater' || key === 'keepSignedIn') {
        // With hidden input + checkbox pattern:
        // - Unchecked: ["false"] (from hidden input)
        // - Checked: ["false", "on"] (hidden input + checkbox)
        // We want the checkbox to override the hidden input
        const hasCheckboxValue = stringValues.includes('on')
        rawData[key] = hasCheckboxValue
      } else if (key === 'tagNames') {
        // Tag names should always be an array, even if there's only one
        rawData[key] = stringValues
      } else if (stringValues.length === 1) {
        // Single value - return as string
        rawData[key] = stringValues[0]
      } else if (stringValues.length > 1) {
        // Multiple values - return as array
        rawData[key] = stringValues
      }
      // If no values, don't set the key (undefined)
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
export function validationErrorResponse(
  errors: ValidationError['fields'],
  status = 400
) {
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
