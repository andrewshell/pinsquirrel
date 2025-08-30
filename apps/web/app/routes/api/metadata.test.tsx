/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loader } from './metadata'
import type { Route } from './+types/metadata'
import {
  InvalidUrlError,
  FetchTimeoutError,
  HttpError,
} from '@pinsquirrel/domain'

// Mock dependencies
vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-123' }),
}))

// Create hoisted mocks
const { mockFetchMetadata, mockMetadataService } = vi.hoisted(() => {
  const mockFetchMetadata = vi.fn()
  const mockMetadataService = vi.fn().mockImplementation(() => ({
    fetchMetadata: mockFetchMetadata,
  }))
  return { mockFetchMetadata, mockMetadataService }
})

vi.mock('@pinsquirrel/services', async () => {
  const actual = await vi.importActual('@pinsquirrel/services')
  return {
    ...actual,
    MetadataService: Object.assign(mockMetadataService, {
      getHttpStatusForError: vi.fn((error: Error) => {
        if (error.name === 'InvalidUrlError') return 400
        if (error.name === 'FetchTimeoutError') return 408
        if (error.name === 'HttpError') return 404
        return 500
      }),
      getUserFriendlyMessage: vi.fn((error: Error) => {
        if (error.name === 'InvalidUrlError') return 'Invalid URL format'
        if (error.name === 'FetchTimeoutError') return 'Request timeout'
        if (error.name === 'HttpError') return 'Failed to fetch URL content'
        return 'Failed to fetch metadata'
      }),
    }),
    AuthenticationService: vi.fn(),
    PinService: vi.fn(),
  }
})

describe('api.metadata loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 for missing url parameter', async () => {
    const request = new Request('http://localhost:3000/api/metadata')
    const args: Route.LoaderArgs = { request, params: {}, context: {} }

    const response = await loader(args)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect((data as { error: string }).error).toBe('Missing url parameter')
  })

  it('should return 400 for invalid URL format', async () => {
    mockFetchMetadata.mockRejectedValue(new InvalidUrlError('not-a-url'))

    const request = new Request(
      'http://localhost:3000/api/metadata?url=not-a-url'
    )
    const args: Route.LoaderArgs = { request, params: {}, context: {} }

    const response = await loader(args)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect((data as { error: string }).error).toBe('Invalid URL format')
  })

  it('should successfully fetch and return metadata', async () => {
    mockFetchMetadata.mockResolvedValue({
      title: 'Test Page Title',
      description: 'Test page description',
    })

    const request = new Request(
      'http://localhost:3000/api/metadata?url=https://example.com'
    )
    const args: Route.LoaderArgs = { request, params: {}, context: {} }

    const response = await loader(args)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      title: 'Test Page Title',
      description: 'Test page description',
    })

    expect(mockFetchMetadata).toHaveBeenCalledWith('https://example.com')
  })

  it('should handle timeout errors', async () => {
    mockFetchMetadata.mockRejectedValue(
      new FetchTimeoutError('https://example.com')
    )

    const request = new Request(
      'http://localhost:3000/api/metadata?url=https://example.com'
    )
    const args: Route.LoaderArgs = { request, params: {}, context: {} }

    const response = await loader(args)
    const data = await response.json()

    expect(response.status).toBe(408)
    expect((data as { error: string }).error).toBe('Request timeout')
  })

  it('should handle not found errors', async () => {
    mockFetchMetadata.mockRejectedValue(
      new HttpError(404, 'https://example.com/notfound')
    )

    const request = new Request(
      'http://localhost:3000/api/metadata?url=https://example.com/notfound'
    )
    const args: Route.LoaderArgs = { request, params: {}, context: {} }

    const response = await loader(args)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect((data as { error: string }).error).toBe(
      'Failed to fetch URL content'
    )
  })

  it('should return 500 for other fetch errors', async () => {
    // Generic error without a specific name should default to 500
    mockFetchMetadata.mockRejectedValue(new Error('Some other error'))

    const request = new Request(
      'http://localhost:3000/api/metadata?url=https://example.com'
    )
    const args: Route.LoaderArgs = { request, params: {}, context: {} }

    const response = await loader(args)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect((data as { error: string }).error).toBe('Failed to fetch metadata')
  })
})
