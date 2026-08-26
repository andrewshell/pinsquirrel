import type { Tag, TagWithCount } from './types.ts'

/**
 * `fetch`, with a bearer token already on it.
 *
 * Structurally `authorizedFetch` from `./auth.ts`, taken as a parameter rather
 * than imported so the client can be handed a stub.
 */
export type AuthorizedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

/**
 * The API answered, and the answer was a refusal.
 *
 * `status` is what the caller branches on; `code` is only there when the
 * server spelled the failure in RFC 6749 terms, which is what the OAuth
 * middleware does on a 401 and the route handlers never do.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * The failure body, in either of the two shapes the server sends.
 *
 * A v1 route answers `{ "error": "Tag not found" }`, where `error` is prose
 * for the user. The OAuth middleware answers the RFC 6749 pair,
 * `{ "error": "invalid_token", "error_description": "..." }`, where `error` is
 * a machine code. The description is what tells the two apart: when it is
 * there, `error` is a code and not a sentence.
 *
 * Not every failure is JSON at all - the rate limiter answers 429 as plain
 * text - so an unreadable body falls back to the status rather than replacing
 * the real failure with a parse error.
 */
async function apiErrorFrom(response: Response): Promise<ApiError> {
  const fallback = `The server answered ${response.status}`

  let fields: Record<string, unknown>
  try {
    fields = ((await response.json()) ?? {}) as Record<string, unknown>
  } catch {
    return new ApiError(response.status, fallback)
  }

  const error = typeof fields.error === 'string' ? fields.error : undefined
  const description =
    typeof fields.error_description === 'string'
      ? fields.error_description
      : undefined

  if (description) return new ApiError(response.status, description, error)
  return new ApiError(response.status, error ?? fallback)
}

/**
 * Runtime shape checks.
 *
 * Enough to catch a body that is not what was asked for - a login page served
 * as HTML by a captive portal, an older server, a proxy's error envelope -
 * before it is cast and read as though it were. They check the fields the
 * extension goes on to use rather than validating the whole schema: the server
 * owns the schema, and no dependency is allowed here to restate it (Decision
 * 5).
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTag(value: unknown): value is Tag {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.name === 'string'
  )
}

function isTagWithCount(value: unknown): value is TagWithCount {
  return isTag(value) && typeof (value as TagWithCount).pinCount === 'number'
}

function isArrayOf<T>(
  guard: (value: unknown) => value is T
): (value: unknown) => value is T[] {
  return (value): value is T[] => Array.isArray(value) && value.every(guard)
}

/** The PinSquirrel v1 REST API, as the extension reads it. */
export class PinSquirrelApiClient {
  private readonly baseUrl: string
  private readonly fetch: AuthorizedFetch

  constructor(config: { baseUrl: string; fetch: AuthorizedFetch }) {
    this.baseUrl = config.baseUrl
    this.fetch = config.fetch
  }

  /**
   * The user's tags, with their pin counts if asked for.
   *
   * Two signatures rather than one returning an optional `pinCount`, because
   * whether the count is there is settled by the argument: a caller that asked
   * for counts should not have to check, and one that did not should not be
   * told they might be there.
   */
  async getTags(): Promise<Tag[]>
  async getTags(withCounts: true): Promise<TagWithCount[]>
  async getTags(withCounts = false): Promise<Tag[]> {
    return this.get(
      '/api/v1/tags',
      withCounts ? { withCounts: 'true' } : {},
      isArrayOf(withCounts ? isTagWithCount : isTag)
    )
  }

  /**
   * One GET: send it, turn a refusal into an `ApiError`, and check the answer
   * is the shape the caller asked for before handing it over.
   *
   * Anything the injected `fetch` throws - a `ReauthorizationRequiredError`
   * above all - passes straight through. The popup branches on that one, and
   * wrapping it in an `ApiError` would turn "the user must consent again" into
   * "the sync failed, try later".
   */
  private async get<T>(
    path: string,
    query: Record<string, string>,
    isShape: (body: unknown) => body is T
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }

    const response = await this.fetch(url.toString())
    if (!response.ok) throw await apiErrorFrom(response)

    const body: unknown = await response.json()
    if (!isShape(body)) {
      throw new Error(
        `The server answered GET ${path} with a body this client does not understand`
      )
    }
    return body
  }
}
