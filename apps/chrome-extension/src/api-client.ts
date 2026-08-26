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
    const url = new URL(`${this.baseUrl}/api/v1/tags`)
    if (withCounts) url.searchParams.set('withCounts', 'true')

    const response = await this.fetch(url.toString())
    return (await response.json()) as Tag[]
  }
}
