import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HtmlParser, HttpFetcher } from '@pinsquirrel/domain'
import {
  InvalidUrlError,
  UnsupportedProtocolError,
  FetchTimeoutError,
  HttpError,
  ParseError,
} from '@pinsquirrel/domain'
import { MetadataService } from './metadata'

describe('MetadataService', () => {
  const mockHttpFetcher: HttpFetcher = {
    fetch: vi.fn(),
  }
  const mockHtmlParser: HtmlParser = {
    parseMetadata: vi.fn(),
  }

  let service: MetadataService

  beforeEach(() => {
    service = new MetadataService(mockHttpFetcher, mockHtmlParser)
    vi.mocked(mockHttpFetcher.fetch).mockClear()
    vi.mocked(mockHtmlParser.parseMetadata).mockClear()
  })

  it('should fetch and parse metadata successfully', async () => {
    const mockHtml = '<html><head><title>Test Title</title></head></html>'
    const mockResult = { title: 'Test Title' }

    vi.mocked(mockHttpFetcher.fetch).mockResolvedValue(mockHtml)
    vi.mocked(mockHtmlParser.parseMetadata).mockReturnValue(mockResult)

    const result = await service.fetchMetadata('https://example.com')

    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith('https://example.com')
    expect(mockHtmlParser.parseMetadata).toHaveBeenCalledWith(mockHtml)
    expect(result).toEqual(mockResult)
  })

  it('should reject invalid URL protocols', async () => {
    await expect(service.fetchMetadata('ftp://example.com')).rejects.toThrow(
      UnsupportedProtocolError
    )

    // Validation happens before fetching, so fetcher should not be called
    expect(mockHttpFetcher.fetch).not.toHaveBeenCalled()
    expect(mockHtmlParser.parseMetadata).not.toHaveBeenCalled()
  })

  it('should reject malformed URLs', async () => {
    await expect(service.fetchMetadata('not-a-url')).rejects.toThrow(
      InvalidUrlError
    )

    // Validation happens before fetching, so fetcher should not be called
    expect(mockHttpFetcher.fetch).not.toHaveBeenCalled()
    expect(mockHtmlParser.parseMetadata).not.toHaveBeenCalled()
  })

  it('should handle fetcher errors', async () => {
    vi.mocked(mockHttpFetcher.fetch).mockRejectedValue(
      new Error('Network error')
    )

    await expect(service.fetchMetadata('https://example.com')).rejects.toThrow(
      'HTTP 500 error while fetching: https://example.com'
    )

    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith('https://example.com')
    expect(mockHtmlParser.parseMetadata).not.toHaveBeenCalled()
  })

  it('should handle timeout errors from fetcher', async () => {
    vi.mocked(mockHttpFetcher.fetch).mockRejectedValue(
      new Error('Request timeout')
    )

    await expect(service.fetchMetadata('https://example.com')).rejects.toThrow(
      FetchTimeoutError
    )

    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith('https://example.com')
    expect(mockHtmlParser.parseMetadata).not.toHaveBeenCalled()
  })

  it('should handle HTTP errors from fetcher', async () => {
    vi.mocked(mockHttpFetcher.fetch).mockRejectedValue(
      new Error('HTTP 404 Not Found')
    )

    const error = await service
      .fetchMetadata('https://example.com')
      .catch(e => e)
    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(404)

    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith('https://example.com')
    expect(mockHtmlParser.parseMetadata).not.toHaveBeenCalled()
  })

  it('should handle parser errors', async () => {
    const mockHtml = '<html><head><title>Test Title</title></head></html>'

    vi.mocked(mockHttpFetcher.fetch).mockResolvedValue(mockHtml)
    vi.mocked(mockHtmlParser.parseMetadata).mockImplementation(() => {
      throw new Error('Parser error')
    })

    await expect(service.fetchMetadata('https://example.com')).rejects.toThrow(
      'Failed to parse metadata from: https://example.com'
    )

    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith('https://example.com')
    expect(mockHtmlParser.parseMetadata).toHaveBeenCalledWith(mockHtml)
  })

  it('should handle unknown errors', async () => {
    vi.mocked(mockHttpFetcher.fetch).mockRejectedValue('string error')

    await expect(service.fetchMetadata('https://example.com')).rejects.toThrow(
      'HTTP 500 error while fetching: https://example.com'
    )
  })

  it('should accept http and https protocols', async () => {
    const mockHtml = '<html></html>'
    const mockResult = {}

    vi.mocked(mockHttpFetcher.fetch).mockResolvedValue(mockHtml)
    vi.mocked(mockHtmlParser.parseMetadata).mockReturnValue(mockResult)

    // Test HTTP
    await service.fetchMetadata('http://example.com')
    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith('http://example.com')

    // Test HTTPS
    await service.fetchMetadata('https://example.com')
    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith('https://example.com')
  })

  describe('getHttpStatusForError', () => {
    it('should return 400 for InvalidUrlError', () => {
      const error = new InvalidUrlError('not-a-url')
      expect(MetadataService.getHttpStatusForError(error)).toBe(400)
    })

    it('should return 400 for UnsupportedProtocolError', () => {
      const error = new UnsupportedProtocolError('ftp://example.com')
      expect(MetadataService.getHttpStatusForError(error)).toBe(400)
    })

    it('should return 408 for FetchTimeoutError', () => {
      const error = new FetchTimeoutError('https://example.com')
      expect(MetadataService.getHttpStatusForError(error)).toBe(408)
    })

    it('should return 404 for HttpError with 4xx status', () => {
      const error = new HttpError(404, 'https://example.com')
      expect(MetadataService.getHttpStatusForError(error)).toBe(404)

      const error403 = new HttpError(403, 'https://example.com')
      expect(MetadataService.getHttpStatusForError(error403)).toBe(404)

      const error400 = new HttpError(400, 'https://example.com')
      expect(MetadataService.getHttpStatusForError(error400)).toBe(404)
    })

    it('should return 500 for HttpError with 5xx status', () => {
      const error = new HttpError(500, 'https://example.com')
      expect(MetadataService.getHttpStatusForError(error)).toBe(500)

      const error503 = new HttpError(503, 'https://example.com')
      expect(MetadataService.getHttpStatusForError(error503)).toBe(500)
    })

    it('should return 500 for HttpError with other status codes', () => {
      const error300 = new HttpError(300, 'https://example.com')
      expect(MetadataService.getHttpStatusForError(error300)).toBe(500)

      const error200 = new HttpError(200, 'https://example.com')
      expect(MetadataService.getHttpStatusForError(error200)).toBe(500)
    })

    it('should return 500 for ParseError', () => {
      const error = new ParseError('https://example.com')
      expect(MetadataService.getHttpStatusForError(error)).toBe(500)
    })

    it('should return 500 for unknown errors', () => {
      const error = new Error('Unknown error')
      expect(MetadataService.getHttpStatusForError(error)).toBe(500)

      const typeError = new TypeError('Type error')
      expect(MetadataService.getHttpStatusForError(typeError)).toBe(500)
    })
  })

  describe('getUserFriendlyMessage', () => {
    it('should return "Invalid URL format" for InvalidUrlError', () => {
      const error = new InvalidUrlError('not-a-url')
      expect(MetadataService.getUserFriendlyMessage(error)).toBe(
        'Invalid URL format'
      )
    })

    it('should return "Invalid URL format" for UnsupportedProtocolError', () => {
      const error = new UnsupportedProtocolError('ftp://example.com')
      expect(MetadataService.getUserFriendlyMessage(error)).toBe(
        'Invalid URL format'
      )
    })

    it('should return "Request timeout" for FetchTimeoutError', () => {
      const error = new FetchTimeoutError('https://example.com')
      expect(MetadataService.getUserFriendlyMessage(error)).toBe(
        'Request timeout'
      )
    })

    it('should return "Failed to fetch URL content" for HttpError with 404 status', () => {
      const error = new HttpError(404, 'https://example.com')
      expect(MetadataService.getUserFriendlyMessage(error)).toBe(
        'Failed to fetch URL content'
      )
    })

    it('should return "Failed to fetch metadata" for HttpError with non-404 status', () => {
      const error500 = new HttpError(500, 'https://example.com')
      expect(MetadataService.getUserFriendlyMessage(error500)).toBe(
        'Failed to fetch metadata'
      )

      const error403 = new HttpError(403, 'https://example.com')
      expect(MetadataService.getUserFriendlyMessage(error403)).toBe(
        'Failed to fetch metadata'
      )

      const error200 = new HttpError(200, 'https://example.com')
      expect(MetadataService.getUserFriendlyMessage(error200)).toBe(
        'Failed to fetch metadata'
      )
    })

    it('should return "Failed to parse metadata" for ParseError', () => {
      const error = new ParseError('https://example.com')
      expect(MetadataService.getUserFriendlyMessage(error)).toBe(
        'Failed to parse metadata'
      )
    })

    it('should return "Failed to fetch metadata" for unknown errors', () => {
      const error = new Error('Unknown error')
      expect(MetadataService.getUserFriendlyMessage(error)).toBe(
        'Failed to fetch metadata'
      )

      const typeError = new TypeError('Type error')
      expect(MetadataService.getUserFriendlyMessage(typeError)).toBe(
        'Failed to fetch metadata'
      )
    })
  })
})
