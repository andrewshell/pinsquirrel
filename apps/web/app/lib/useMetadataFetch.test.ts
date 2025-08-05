import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMetadataFetch } from './useMetadataFetch'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useMetadataFetch', () => {
  beforeEach(() => {
    mockFetch.mockClear()
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
      json: () => Promise.resolve(mockResponse)
    })

    const { result } = renderHook(() => useMetadataFetch())
    
    act(() => {
      result.current.fetchMetadata('https://example.com')
    })
    
    expect(result.current.loading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    }, { timeout: 1000 })
    
    expect(result.current.metadata).toEqual(mockResponse)
    expect(result.current.error).toBe(null)
    expect(mockFetch).toHaveBeenCalledWith('/api/metadata?url=https%3A%2F%2Fexample.com')
  })

  it('should handle fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useMetadataFetch())
    
    act(() => {
      result.current.fetchMetadata('https://example.com')
    })
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    }, { timeout: 1000 })
    
    expect(result.current.error).toBe('Failed to fetch metadata')
    expect(result.current.metadata).toBe(null)
  })

  it('should handle API error responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    const { result } = renderHook(() => useMetadataFetch())
    
    act(() => {
      result.current.fetchMetadata('https://example.com')
    })
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    }, { timeout: 1000 })
    
    expect(result.current.error).toBe('Failed to fetch metadata')
    expect(result.current.metadata).toBe(null)
  })

  it('should not fetch for invalid URLs', () => {
    const { result } = renderHook(() => useMetadataFetch())
    
    act(() => {
      result.current.fetchMetadata('not-a-url')
    })
    
    expect(result.current.loading).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should not fetch for empty URLs', () => {
    const { result } = renderHook(() => useMetadataFetch())
    
    act(() => {
      result.current.fetchMetadata('')
    })
    
    expect(result.current.loading).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should clear previous metadata on new fetch', async () => {
    const mockResponse1 = { title: 'First Title' }
    const mockResponse2 = { title: 'Second Title' }
    
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse1)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse2)
      })

    const { result } = renderHook(() => useMetadataFetch())
    
    // First fetch
    act(() => {
      result.current.fetchMetadata('https://example1.com')
    })
    
    await waitFor(() => {
      expect(result.current.metadata).toEqual(mockResponse1)
    }, { timeout: 1000 })
    
    // Second fetch should clear previous metadata
    act(() => {
      result.current.fetchMetadata('https://example2.com')
    })
    
    expect(result.current.metadata).toBe(null)
    expect(result.current.loading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.metadata).toEqual(mockResponse2)
    }, { timeout: 1000 })
  })

  it('should clear error on successful fetch', async () => {
    const mockResponse = { title: 'Test Title' }
    
    // First call fails
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    
    const { result } = renderHook(() => useMetadataFetch())
    
    act(() => {
      result.current.fetchMetadata('https://example.com')
    })
    
    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch metadata')
    }, { timeout: 1000 })
    
    // Second call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    
    act(() => {
      result.current.fetchMetadata('https://example.com')
    })
    
    await waitFor(() => {
      expect(result.current.error).toBe(null)
      expect(result.current.metadata).toEqual(mockResponse)
    }, { timeout: 1000 })
  })
})