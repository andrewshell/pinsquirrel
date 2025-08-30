import type {
  HttpFetcher,
  HtmlParser,
  MetadataResult,
} from '@pinsquirrel/domain'
import {
  InvalidUrlError,
  UnsupportedProtocolError,
  FetchTimeoutError,
  HttpError,
  ParseError,
} from '@pinsquirrel/domain'
import { validateUrlForFetching } from '../validation/url.js'

export class MetadataService {
  constructor(
    private httpFetcher: HttpFetcher,
    private htmlParser: HtmlParser
  ) {}

  async fetchMetadata(url: string): Promise<MetadataResult> {
    try {
      // Validate URL before fetching
      validateUrlForFetching(url)

      // Fetch HTML content
      let html: string
      try {
        html = await this.httpFetcher.fetch(url)
      } catch (error) {
        if (error instanceof Error) {
          // Map common HTTP fetcher errors to specific types
          if (error.message.includes('timeout')) {
            throw new FetchTimeoutError(url)
          }
          if (error.message.includes('HTTP')) {
            const statusMatch = error.message.match(/HTTP (\d+)/)
            const status = statusMatch ? parseInt(statusMatch[1], 10) : 500
            throw new HttpError(status, url)
          }
        }
        // Re-throw unknown errors as generic fetch errors
        throw new HttpError(500, url)
      }

      // Parse metadata
      try {
        return this.htmlParser.parseMetadata(html)
      } catch {
        throw new ParseError(url)
      }
    } catch (error) {
      // Re-throw specific errors as-is, wrap unknown errors
      if (
        error instanceof InvalidUrlError ||
        error instanceof UnsupportedProtocolError ||
        error instanceof FetchTimeoutError ||
        error instanceof HttpError ||
        error instanceof ParseError
      ) {
        throw error
      }

      // Fallback for any unexpected errors
      throw new ParseError(url)
    }
  }

  /**
   * Map metadata errors to HTTP status codes for API responses
   */
  static getHttpStatusForError(error: Error): number {
    if (
      error instanceof InvalidUrlError ||
      error instanceof UnsupportedProtocolError
    ) {
      return 400 // Bad Request
    }
    if (error instanceof FetchTimeoutError) {
      return 408 // Request Timeout
    }
    if (error instanceof HttpError) {
      return error.status >= 400 && error.status < 500 ? 404 : 500
    }
    if (error instanceof ParseError) {
      return 500 // Internal Server Error
    }
    return 500 // Default to Internal Server Error
  }

  /**
   * Get user-friendly error message for API responses
   */
  static getUserFriendlyMessage(error: Error): string {
    if (
      error instanceof InvalidUrlError ||
      error instanceof UnsupportedProtocolError
    ) {
      return 'Invalid URL format'
    }
    if (error instanceof FetchTimeoutError) {
      return 'Request timeout'
    }
    if (error instanceof HttpError) {
      return error.status === 404
        ? 'Failed to fetch URL content'
        : 'Failed to fetch metadata'
    }
    if (error instanceof ParseError) {
      return 'Failed to parse metadata'
    }
    return 'Failed to fetch metadata'
  }
}
