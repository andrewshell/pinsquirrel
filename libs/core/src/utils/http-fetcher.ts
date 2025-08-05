export interface HttpFetcher {
  fetch(url: string): Promise<string>
}

export class NodeHttpFetcher implements HttpFetcher {
  constructor(
    private fetchFn: typeof fetch = globalThis.fetch,
    private timeout: number = 10000
  ) {}

  async fetch(url: string): Promise<string> {
    const response = await this.fetchFn(url, {
      headers: {
        'User-Agent': 'PinSquirrel/1.0 (Bookmark Metadata Fetcher)',
      },
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.text()
  }
}