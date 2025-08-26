import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMetadataFetch } from './useMetadataFetch'

// Mock console.error to prevent error logs in test output
const mockConsoleError = vi.fn()
const originalConsoleError = console.error
let mockFetch: ReturnType<typeof vi.fn>

describe('useMetadataFetch - isolated tests', () => {
  beforeEach(() => {
    // Create a completely fresh mock for each test
    mockFetch = vi.fn()
    global.fetch = mockFetch
    // Replace console.error with mock to keep test output clean
    console.error = mockConsoleError
    mockConsoleError.mockClear()
  })

  afterEach(() => {
    // Restore original console.error
    console.error = originalConsoleError
  })

  it('should clear previous metadata on new fetch', async () => {
    const mockResponse1 = { title: 'First Title' }
    const mockResponse2 = { title: 'Second Title' }

    const { result } = renderHook(() => useMetadataFetch())

    // Setup mock for first fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse1),
    })

    // First fetch
    act(() => {
      result.current.fetchMetadata('https://example1.com')
    })

    expect(result.current.loading).toBe(true)

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false)
      },
      { timeout: 1000 }
    )

    expect(result.current.metadata).toEqual(mockResponse1)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/metadata?url=https%3A%2F%2Fexample1.com'
    )

    // Setup mock for second fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse2),
    })

    // Second fetch should clear previous metadata immediately
    act(() => {
      result.current.fetchMetadata('https://example2.com')
    })

    // Metadata should be cleared immediately (not after debounce)
    expect(result.current.metadata).toBe(null)
    expect(result.current.loading).toBe(true)

    // Wait for the second fetch to complete
    await waitFor(
      () => {
        expect(result.current.metadata).toEqual(mockResponse2)
      },
      { timeout: 1000 }
    )
  })
})
