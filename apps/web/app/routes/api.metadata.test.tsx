/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loader } from './api.metadata'
import type { Route } from './+types/api.metadata'

// Mock dependencies
vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-123' })
}))

// Create hoisted mocks
const { mockFetchMetadata, mockHttpMetadataService } = vi.hoisted(() => {
  const mockFetchMetadata = vi.fn()
  const mockHttpMetadataService = vi.fn().mockImplementation(() => ({
    fetchMetadata: mockFetchMetadata
  }))
  return { mockFetchMetadata, mockHttpMetadataService }
})

vi.mock('@pinsquirrel/core', () => ({
  HttpMetadataService: mockHttpMetadataService,
  CheerioHtmlParser: vi.fn(),
  NodeHttpFetcher: vi.fn()
}))

vi.mock('~/lib/logger.server', () => ({
  logger: {
    info: vi.fn(),
    exception: vi.fn()
  }
}))

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
    mockFetchMetadata.mockRejectedValue(new Error('Invalid URL format'))
    
    const request = new Request('http://localhost:3000/api/metadata?url=not-a-url')
    const args: Route.LoaderArgs = { request, params: {}, context: {} }
    
    const response = await loader(args)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect((data as { error: string }).error).toBe('Invalid URL format')
  })

  it('should successfully fetch and return metadata', async () => {
    mockFetchMetadata.mockResolvedValue({
      title: 'Test Page Title',
      description: 'Test page description'
    })
    
    const request = new Request('http://localhost:3000/api/metadata?url=https://example.com')
    const args: Route.LoaderArgs = { request, params: {}, context: {} }
    
    const response = await loader(args)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toEqual({
      title: 'Test Page Title',
      description: 'Test page description'
    })
    
    expect(mockFetchMetadata).toHaveBeenCalledWith('https://example.com')
  })

  it('should handle timeout errors', async () => {
    mockFetchMetadata.mockRejectedValue(new Error('TimeoutError: Request timeout'))
    
    const request = new Request('http://localhost:3000/api/metadata?url=https://example.com')
    const args: Route.LoaderArgs = { request, params: {}, context: {} }
    
    const response = await loader(args)
    const data = await response.json()
    
    expect(response.status).toBe(408)
    expect((data as { error: string }).error).toBe('Request timeout')
  })

  it('should handle not found errors', async () => {
    mockFetchMetadata.mockRejectedValue(new Error('HTTP 404: Not Found'))
    
    const request = new Request('http://localhost:3000/api/metadata?url=https://example.com/notfound')
    const args: Route.LoaderArgs = { request, params: {}, context: {} }
    
    const response = await loader(args)
    const data = await response.json()
    
    expect(response.status).toBe(404)
    expect((data as { error: string }).error).toBe('Failed to fetch URL content')
  })

  it('should return 500 for other fetch errors', async () => {
    mockFetchMetadata.mockRejectedValue(new Error('Some other error'))
    
    const request = new Request('http://localhost:3000/api/metadata?url=https://example.com')
    const args: Route.LoaderArgs = { request, params: {}, context: {} }
    
    const response = await loader(args)
    const data = await response.json()
    
    expect(response.status).toBe(500)
    expect((data as { error: string }).error).toBe('Failed to fetch metadata')
  })
})