import type { HttpFetcher } from '@pinsquirrel/domain'
import { FetchTimeoutError, HttpError } from '@pinsquirrel/domain'

export class NodeHttpFetcher implements HttpFetcher {
  constructor(
    private fetchFn: typeof fetch = globalThis.fetch,
    private timeout: number = 10000
  ) {}

  async fetch(url: string): Promise<string> {
    let response: Response
    try {
      response = await this.fetchFn(url, {
        headers: {
          'User-Agent': 'PinSquirrel/1.0 (Bookmark Metadata Fetcher)',
        },
        signal: AbortSignal.timeout(this.timeout),
      })
    } catch (error) {
      // AbortSignal.timeout rejects with a TimeoutError DOMException; an
      // explicit abort surfaces as AbortError. Both mean "took too long".
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new FetchTimeoutError(url)
      }
      throw error
    }

    if (!response.ok) {
      throw new HttpError(response.status, url)
    }

    return response.text()
  }
}
