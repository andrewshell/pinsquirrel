import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FetchTimeoutError, HttpError } from '@pinsquirrel/domain'
import { NodeHttpFetcher } from './node-http-fetcher.js'

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
      text: () => Promise.resolve(mockHtml),
    })

    const result = await fetcher.fetch('https://example.com')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
      headers: {
        'User-Agent': 'PinSquirrel/1.0 (Bookmark Metadata Fetcher)',
      },
      signal: expect.any(AbortSignal) as AbortSignal,
    })
    expect(result).toBe(mockHtml)
  })

  it('should throw HttpError carrying the status for a non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const error: unknown = await fetcher
      .fetch('https://example.com')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(404)
    expect((error as HttpError).message).toContain('https://example.com')
  })

  it('should throw FetchTimeoutError when the request times out', async () => {
    mockFetch.mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError'
      )
    )

    await expect(fetcher.fetch('https://example.com')).rejects.toBeInstanceOf(
      FetchTimeoutError
    )
  })

  it('should throw FetchTimeoutError when the request is aborted', async () => {
    mockFetch.mockRejectedValue(
      new DOMException('The operation was aborted', 'AbortError')
    )

    await expect(fetcher.fetch('https://example.com')).rejects.toBeInstanceOf(
      FetchTimeoutError
    )
  })

  it('should propagate network errors unchanged', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(fetcher.fetch('https://example.com')).rejects.toThrow(
      'Network error'
    )
  })

  it('should use custom timeout', async () => {
    const customFetcher = new NodeHttpFetcher(mockFetch, 3000)
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html></html>'),
    })

    await customFetcher.fetch('https://example.com')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
      headers: {
        'User-Agent': 'PinSquirrel/1.0 (Bookmark Metadata Fetcher)',
      },
      signal: expect.any(AbortSignal) as AbortSignal,
    })
  })
})
