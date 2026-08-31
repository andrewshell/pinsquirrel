import {
  PinNotFoundError,
  TagNotFoundError,
  UnauthorizedPinAccessError,
  UnauthorizedTagAccessError,
  ValidationError,
} from '@pinsquirrel/domain'
import { InsufficientScopeError } from './scopes.js'

/**
 * Map a thrown domain error to an MCP `CallToolResult` with `isError: true`.
 *
 * Mirrors the REST `errorResponse` helper in `routes/api-v1.ts`, but produces
 * structured MCP content instead of an HTTP status. Unknown errors collapse
 * to a generic message so internal details do not leak to the agent.
 */
export function mapDomainErrorToMcp(err: unknown) {
  let message: string
  if (err instanceof InsufficientScopeError) {
    // The one refusal that says exactly what is wrong. Everything else here
    // withholds detail because the caller might be probing; a scope the
    // connection was never granted is not a fact the caller can misuse, and a
    // model told only "internal server error" retries a call that can never
    // succeed until the user re-authorizes.
    message = err.message
  } else if (err instanceof ValidationError) {
    message = 'Invalid request'
  } else if (
    err instanceof PinNotFoundError ||
    err instanceof UnauthorizedPinAccessError
  ) {
    // Matching the REST 404: a pin owned by another user reads exactly like
    // one that does not exist, and the id is not echoed back, so the wording
    // alone cannot confirm that the id is real.
    message = 'Pin not found'
  } else if (
    err instanceof TagNotFoundError ||
    err instanceof UnauthorizedTagAccessError
  ) {
    message = 'Tag not found'
  } else {
    message = 'Internal server error'
  }
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  }
}
