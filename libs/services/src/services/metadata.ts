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
  MetadataError,
  ParseError,
} from '@pinsquirrel/domain'
import { validateUrlForFetching } from '../validation/url.js'

export class MetadataService {
  constructor(
    private httpFetcher: HttpFetcher,
    private htmlParser: HtmlParser
  ) {}

  async fetchMetadata(url: string): Promise<MetadataResult> {
    // Throws InvalidUrlError / UnsupportedProtocolError
    validateUrlForFetching(url)

    let html: string
    try {
      html = await this.httpFetcher.fetch(url)
    } catch (error) {
      // Fetchers classify their own failures (FetchTimeoutError, HttpError);
      // anything else is a transport failure we cannot attribute.
      if (error instanceof MetadataError) {
        throw error
      }
      throw new HttpError(500, url)
    }

    try {
      return this.htmlParser.parseMetadata(html)
    } catch {
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
      return error.status >= 400 && error.status < 500 ? 422 : 502
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
      if (error.status === 403) {
        return 'Site blocked the request (bot protection)'
      }
      if (error.status === 404) {
        return 'Page not found at this URL'
      }
      return `Remote server error (HTTP ${String(error.status)})`
    }
    if (error instanceof ParseError) {
      return 'Failed to parse metadata'
    }
    return 'Failed to fetch metadata'
  }
}
