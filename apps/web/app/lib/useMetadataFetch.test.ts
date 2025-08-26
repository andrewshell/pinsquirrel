import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMetadataFetch } from './useMetadataFetch'

// Mock console.error to prevent error logs in test output
const mockConsoleError = vi.fn()
const originalConsoleError = console.error
let mockFetch: ReturnType<typeof vi.fn>

describe('useMetadataFetch', () => {
  beforeEach(() => {
    // Mock all timers to control debouncing if needed
    vi.clearAllTimers()

    // Create a completely fresh mock for each test
    mockFetch = vi.fn()

    // Set fresh global fetch mock
    global.fetch = mockFetch

    // Replace console.error with mock to keep test output clean
    console.error = mockConsoleError
    mockConsoleError.mockClear()
  })

  afterEach(() => {
    // Restore original console.error
    console.error = originalConsoleError
  })

  it('should return initial state', () => {
    const { result } = renderHook(() => useMetadataFetch())

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.metadata).toBe(null)
    expect(typeof result.current.fetchMetadata).toBe('function')
  })

  it('should fetch metadata for valid URL', async () => {
    const mockResponse = { title: 'Test Page Title' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const { result } = renderHook(() => useMetadataFetch())

    act(() => {
      result.current.fetchMetadata('https://example.com')
    })

    expect(result.current.loading).toBe(true)

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false)
      },
      { timeout: 1000 }
    )

    expect(result.current.metadata).toEqual(mockResponse)
    expect(result.current.error).toBe(null)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/metadata?url=https%3A%2F%2Fexample.com'
    )
  })

  it('should handle fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useMetadataFetch())

    act(() => {
      result.current.fetchMetadata('https://example.com')
    })

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false)
      },
      { timeout: 1000 }
    )

    expect(result.current.error).toBe('Failed to fetch metadata')
    expect(result.current.metadata).toBe(null)
  })

  it('should handle API error responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const { result } = renderHook(() => useMetadataFetch())

    act(() => {
      result.current.fetchMetadata('https://example.com')
    })

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false)
      },
      { timeout: 1000 }
    )

    expect(result.current.error).toBe('Failed to fetch metadata')
    expect(result.current.metadata).toBe(null)
  })

  it('should fetch for any non-empty URL (server validates)', () => {
    const { result } = renderHook(() => useMetadataFetch())

    act(() => {
      result.current.fetchMetadata('not-a-url')
    })

    // Now tries to fetch even invalid URLs - server handles validation
    expect(result.current.loading).toBe(true)
  })

  it('should not fetch for empty URLs', () => {
    const { result } = renderHook(() => useMetadataFetch())

    act(() => {
      result.current.fetchMetadata('')
    })

    expect(result.current.loading).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should clear error on successful fetch', async () => {
    const mockResponse = { title: 'Test Title' }

    // First call fails
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useMetadataFetch())

    act(() => {
      result.current.fetchMetadata('https://example.com')
    })

    await waitFor(
      () => {
        expect(result.current.error).toBe('Failed to fetch metadata')
      },
      { timeout: 1000 }
    )

    // Second call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    act(() => {
      result.current.fetchMetadata('https://example.com')
    })

    await waitFor(
      () => {
        expect(result.current.error).toBe(null)
        expect(result.current.metadata).toEqual(mockResponse)
      },
      { timeout: 1000 }
    )
  })
})
