import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pin } from '@pinsquirrel/core'

// Create mock functions in hoisted scope
const mockFindByUserId = vi.hoisted(() => vi.fn())
const mockCountByUserId = vi.hoisted(() => vi.fn())

// Mock the session.server module
vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn(),
  getSession: vi.fn().mockResolvedValue({}),
  getFlashMessage: vi.fn().mockResolvedValue(null),
  commitSession: vi.fn().mockResolvedValue('cookie-string'),
}))

// Mock the database repositories
vi.mock('@pinsquirrel/database', () => ({
  DrizzlePinRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindByUserId,
    countByUserId: mockCountByUserId,
  })),
  DrizzleTagRepository: vi.fn().mockImplementation(() => ({})),
  db: {},
}))

import { requireUser } from '~/lib/session.server'
import { loader } from './pins'

const mockRequireUser = vi.mocked(requireUser)

describe('pins route loader', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    passwordHash: 'hash',
    emailHash: 'emailhash',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockPins: Pin[] = [
    {
      id: 'pin-1',
      userId: 'user-1',
      url: 'https://example.com',
      title: 'Example Pin',
      description: 'A test pin',
      readLater: false,
      contentPath: null,
      imagePath: null,
      tags: [
        {
          id: 'tag-1',
          userId: 'user-1',
          name: 'javascript',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    {
      id: 'pin-2',
      userId: 'user-1',
      url: 'https://example2.com',
      title: 'Another Pin',
      description: null,
      readLater: true,
      contentPath: null,
      imagePath: null,
      tags: [],
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireUser.mockResolvedValue(mockUser)
  })

  it('returns paginated pins with correct metadata', async () => {
    mockFindByUserId.mockResolvedValue(mockPins)
    mockCountByUserId.mockResolvedValue(50)

    const request = new Request('http://localhost/pins')
    const result = await loader({ request } as Parameters<typeof loader>[0])

    expect(result).toEqual({
      pins: mockPins,
      totalPages: 2, // Math.ceil(50 / 25)
      currentPage: 1,
      totalCount: 50,
      successMessage: null,
      errorMessage: null,
    })

    expect(mockFindByUserId).toHaveBeenCalledWith('user-1', {
      limit: 25,
      offset: 0,
    })
    expect(mockCountByUserId).toHaveBeenCalledWith('user-1')
  })

  it('handles page parameter correctly', async () => {
    mockFindByUserId.mockResolvedValue([])
    mockCountByUserId.mockResolvedValue(75)

    const request = new Request('http://localhost/pins?page=3')
    const result = await loader({ request } as Parameters<typeof loader>[0])

    expect(result.currentPage).toBe(3)
    expect(result.totalPages).toBe(3) // Math.ceil(75 / 25)

    expect(mockFindByUserId).toHaveBeenCalledWith('user-1', {
      limit: 25,
      offset: 50, // (page 3 - 1) * 25
    })
  })

  it('defaults to page 1 for invalid page parameter', async () => {
    mockFindByUserId.mockResolvedValue([])
    mockCountByUserId.mockResolvedValue(10)

    const request = new Request('http://localhost/pins?page=invalid')
    const result = await loader({ request } as Parameters<typeof loader>[0])

    expect(result.currentPage).toBe(1)
    expect(mockFindByUserId).toHaveBeenCalledWith('user-1', {
      limit: 25,
      offset: 0,
    })
  })

  it('handles zero page parameter', async () => {
    mockFindByUserId.mockResolvedValue([])
    mockCountByUserId.mockResolvedValue(10)

    const request = new Request('http://localhost/pins?page=0')
    const result = await loader({ request } as Parameters<typeof loader>[0])

    expect(result.currentPage).toBe(1)
    expect(mockFindByUserId).toHaveBeenCalledWith('user-1', {
      limit: 25,
      offset: 0,
    })
  })

  it('handles negative page parameter', async () => {
    mockFindByUserId.mockResolvedValue([])
    mockCountByUserId.mockResolvedValue(10)

    const request = new Request('http://localhost/pins?page=-5')
    const result = await loader({ request } as Parameters<typeof loader>[0])

    expect(result.currentPage).toBe(1)
  })

  it('requires user authentication', async () => {
    mockFindByUserId.mockResolvedValue([])
    mockCountByUserId.mockResolvedValue(0)

    const request = new Request('http://localhost/pins')
    await loader({ request } as Parameters<typeof loader>[0])

    expect(mockRequireUser).toHaveBeenCalledWith(request)
  })

  it('handles empty result set correctly', async () => {
    mockFindByUserId.mockResolvedValue([])
    mockCountByUserId.mockResolvedValue(0)

    const request = new Request('http://localhost/pins')
    const result = await loader({ request } as Parameters<typeof loader>[0])

    expect(result).toEqual({
      pins: [],
      totalPages: 1, // Always at least 1 page
      currentPage: 1,
      totalCount: 0,
      successMessage: null,
      errorMessage: null,
    })
  })

  it('calculates totalPages correctly for edge cases', async () => {
    mockFindByUserId.mockResolvedValue([])

    // Exactly divisible by page size
    mockCountByUserId.mockResolvedValue(25)
    let request = new Request('http://localhost/pins')
    let result = await loader({ request } as Parameters<typeof loader>[0])
    expect(result.totalPages).toBe(1)

    // One more than page size
    mockCountByUserId.mockResolvedValue(26)
    request = new Request('http://localhost/pins')
    result = await loader({ request } as Parameters<typeof loader>[0])
    expect(result.totalPages).toBe(2)

    // Large number
    mockCountByUserId.mockResolvedValue(1000)
    request = new Request('http://localhost/pins')
    result = await loader({ request } as Parameters<typeof loader>[0])
    expect(result.totalPages).toBe(40) // Math.ceil(1000 / 25)
  })

  it('handles repository errors gracefully', async () => {
    mockRequireUser.mockResolvedValue(mockUser)
    mockFindByUserId.mockRejectedValue(new Error('Database error'))
    mockCountByUserId.mockResolvedValue(0)

    const request = new Request('http://localhost/pins')

    await expect(
      loader({ request } as Parameters<typeof loader>[0])
    ).rejects.toThrow('Database error')
  })

  it('handles authentication errors', async () => {
    mockRequireUser.mockRejectedValue(new Error('Unauthorized'))

    const request = new Request('http://localhost/pins')

    await expect(
      loader({ request } as Parameters<typeof loader>[0])
    ).rejects.toThrow('Unauthorized')
  })
})
