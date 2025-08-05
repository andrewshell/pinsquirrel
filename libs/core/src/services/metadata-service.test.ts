import { describe, it, expect, vi } from 'vitest'
import { HttpMetadataService } from './metadata-service'
import type { HttpFetcher } from '../utils/http-fetcher'
import type { HtmlParser } from '../utils/html-parser'

describe('HttpMetadataService', () => {
  const mockHttpFetcher: HttpFetcher = {
    fetch: vi.fn()
  }
  const mockHtmlParser: HtmlParser = {
    parseMetadata: vi.fn()
  }
  
  let service: HttpMetadataService

  beforeEach(() => {
    service = new HttpMetadataService(mockHttpFetcher, mockHtmlParser)
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
    await expect(service.fetchMetadata('ftp://example.com'))
      .rejects.toThrow('Failed to fetch metadata: Invalid URL protocol')
    
    expect(mockHttpFetcher.fetch).not.toHaveBeenCalled()
    expect(mockHtmlParser.parseMetadata).not.toHaveBeenCalled()
  })

  it('should reject malformed URLs', async () => {
    await expect(service.fetchMetadata('not-a-url'))
      .rejects.toThrow('Failed to fetch metadata')
    
    expect(mockHttpFetcher.fetch).not.toHaveBeenCalled()
    expect(mockHtmlParser.parseMetadata).not.toHaveBeenCalled()
  })

  it('should handle fetcher errors', async () => {
    vi.mocked(mockHttpFetcher.fetch).mockRejectedValue(new Error('Network error'))

    await expect(service.fetchMetadata('https://example.com'))
      .rejects.toThrow('Failed to fetch metadata: Network error')
    
    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith('https://example.com')
    expect(mockHtmlParser.parseMetadata).not.toHaveBeenCalled()
  })

  it('should handle parser errors', async () => {
    const mockHtml = '<html><head><title>Test Title</title></head></html>'
    
    vi.mocked(mockHttpFetcher.fetch).mockResolvedValue(mockHtml)
    vi.mocked(mockHtmlParser.parseMetadata).mockImplementation(() => {
      throw new Error('Parser error')
    })

    await expect(service.fetchMetadata('https://example.com'))
      .rejects.toThrow('Failed to fetch metadata: Parser error')
    
    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith('https://example.com')
    expect(mockHtmlParser.parseMetadata).toHaveBeenCalledWith(mockHtml)
  })

  it('should handle unknown errors', async () => {
    vi.mocked(mockHttpFetcher.fetch).mockRejectedValue('string error')

    await expect(service.fetchMetadata('https://example.com'))
      .rejects.toThrow('Failed to fetch metadata: Unknown error')
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
})