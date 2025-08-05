import { describe, it, expect, vi } from 'vitest'
import { NodeHttpFetcher } from './http-fetcher'

describe('NodeHttpFetcher', () => {
  const mockFetch = vi.fn()
  let fetcher: NodeHttpFetcher

  beforeEach(() => {
    fetcher = new NodeHttpFetcher(mockFetch, 5000)
    mockFetch.mockClear()
  })

  it('should fetch HTML successfully', async () => {
    const mockHtml = '<html><head><title>Test</title></head></html>'
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml)
    })

    const result = await fetcher.fetch('https://example.com')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
      headers: {
        'User-Agent': 'PinSquirrel/1.0 (Bookmark Metadata Fetcher)',
      },
      signal: expect.any(AbortSignal)
    })
    expect(result).toBe(mockHtml)
  })

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    await expect(fetcher.fetch('https://example.com'))
      .rejects.toThrow('HTTP 404: Not Found')
  })

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(fetcher.fetch('https://example.com'))
      .rejects.toThrow('Network error')
  })

  it('should use custom timeout', async () => {
    const customFetcher = new NodeHttpFetcher(mockFetch, 3000)
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html></html>')
    })

    await customFetcher.fetch('https://example.com')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
      headers: {
        'User-Agent': 'PinSquirrel/1.0 (Bookmark Metadata Fetcher)',
      },
      signal: expect.any(AbortSignal)
    })
  })
})