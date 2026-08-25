import { ValidationError } from '@pinsquirrel/domain'
import type { ZodError } from 'zod'

/**
 * The single Zod issue → ValidationError conversion for every service.
 *
 * Every issue is reported, grouped by its dotted path, so a caller sees all of
 * what is wrong with its input at once. Issues raised on the schema root (a
 * bare `z.string()`, for example) have no path and land under `fallbackField`.
 */
export function validationErrorFromZod(
  error: ZodError,
  options: { fallbackField?: string; message?: string } = {}
): ValidationError {
  const { fallbackField = 'unknown', message } = options
  const fields: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const field = issue.path.join('.') || fallbackField
    fields[field] ??= []
    fields[field].push(issue.message)
  }

  return new ValidationError(fields, message)
}
