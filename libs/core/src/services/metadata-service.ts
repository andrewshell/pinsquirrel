import type { HttpFetcher } from '../utils/http-fetcher'
import type { HtmlParser } from '../utils/html-parser'

export interface MetadataResult {
  title?: string
  description?: string
}

export interface MetadataService {
  fetchMetadata(url: string): Promise<MetadataResult>
}

export class HttpMetadataService implements MetadataService {
  constructor(
    private httpFetcher: HttpFetcher,
    private htmlParser: HtmlParser
  ) {}

  async fetchMetadata(url: string): Promise<MetadataResult> {
    try {
      // Validate URL format
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid URL protocol')
      }

      const html = await this.httpFetcher.fetch(url)
      return this.htmlParser.parseMetadata(html)
    } catch (error) {
      // Re-throw with consistent error handling
      throw new Error(`Failed to fetch metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}