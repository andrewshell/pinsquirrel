import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loader } from './pins'

// Mock the session.server module
vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn(),
}))

// Mock the database repositories
vi.mock('@pinsquirrel/database', () => ({
  DrizzlePinRepository: vi.fn(),
  DrizzleTagRepository: vi.fn(),
  db: {},
}))

import { requireUser } from '~/lib/session.server'

const mockRequireUser = vi.mocked(requireUser)

describe('pins route loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty pins array with pagination data', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' }
    mockRequireUser.mockResolvedValue(mockUser)

    const request = new Request('http://localhost/pins')
    const result = await loader({ request } as Parameters<typeof loader>[0])

    expect(result).toEqual({
      pins: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
    })
  })

  it('handles page parameter from URL', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' }
    mockRequireUser.mockResolvedValue(mockUser)

    const request = new Request('http://localhost/pins?page=3')
    const result = await loader({ request } as Parameters<typeof loader>[0])

    expect(result.currentPage).toBe(3)
  })

  it('defaults to page 1 for invalid page parameter', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' }
    mockRequireUser.mockResolvedValue(mockUser)

    const request = new Request('http://localhost/pins?page=invalid')
    const result = await loader({ request } as Parameters<typeof loader>[0])

    expect(result.currentPage).toBe(1)
  })

  it('requires user authentication', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' }
    mockRequireUser.mockResolvedValue(mockUser)

    const request = new Request('http://localhost/pins')
    await loader({ request } as Parameters<typeof loader>[0])

    expect(mockRequireUser).toHaveBeenCalledWith(request)
  })
})