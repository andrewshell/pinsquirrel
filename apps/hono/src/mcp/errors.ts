import {
  PinNotFoundError,
  TagNotFoundError,
  UnauthorizedPinAccessError,
  UnauthorizedTagAccessError,
  ValidationError,
} from '@pinsquirrel/domain'

/**
 * Map a thrown domain error to an MCP `CallToolResult` with `isError: true`.
 *
 * Mirrors the REST `errorResponse` helper in `routes/api-v1.ts`, but produces
 * structured MCP content instead of an HTTP status. Unknown errors collapse
 * to a generic message so internal details do not leak to the agent.
 */
export function mapDomainErrorToMcp(err: unknown) {
  let message: string
  if (err instanceof ValidationError) {
    message = 'Invalid request'
  } else if (
    err instanceof PinNotFoundError ||
    err instanceof TagNotFoundError
  ) {
    message = err.message
  } else if (
    err instanceof UnauthorizedPinAccessError ||
    err instanceof UnauthorizedTagAccessError
  ) {
    message = 'Unauthorized'
  } else {
    message = 'Internal server error'
  }
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  }
}
