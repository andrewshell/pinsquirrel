import type { ValidationError } from '@pinsquirrel/domain'

/**
 * A `ValidationError` rendered as one RFC 6749 `error_description` line.
 *
 * The services layer converts every Zod failure with `validationErrorFromZod`,
 * which keeps the failures per field. OAuth has no per-field error shape, so
 * the transport flattens them here rather than the service doing it: the same
 * `ValidationError` becomes `invalid_request` at the token endpoint and
 * `invalid_client_metadata` at the registration endpoint, and only the route
 * knows which.
 */
export function describeValidationError(error: ValidationError): string {
  const described = Object.entries(error.fields).map(
    ([field, messages]) => `${field}: ${messages.join(', ')}`
  )
  return described.length > 0 ? described.join('; ') : error.message
}
