import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TagWithCount } from '@pinsquirrel/domain'

// Mock React Router hooks for integration testing
let mockLoaderData: {
  tags: TagWithCount[]
  username: string
  currentFilter: string
  untaggedPinsCount: number
} = {
  tags: [],
  username: '',
  currentFilter: 'all',
  untaggedPinsCount: 0,
}

// Vitest hoists vi.mock calls, so we need to define mocks inline
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useLoaderData: () => mockLoaderData,
  }
})

vi.mock('~/lib/services/container.server', () => ({
  tagService: {
    getUserTagsWithCount: vi.fn().mockResolvedValue([]),
    deleteTagsWithNoPins: vi.fn().mockResolvedValue(undefined),
  },
  pinService: {
    getUserPinsWithPagination: vi.fn().mockResolvedValue({
      pins: [],
      pagination: { totalPages: 1, page: 1 },
      totalCount: 0,
    }),
  },
}))

vi.mock('~/lib/session.server', () => ({
  requireAccessControl: vi.fn().mockResolvedValue({
    user: {
      id: 'user1',
      username: 'testuser',
      emailHash: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    canCreate: () => true,
  }),
}))

vi.mock('~/lib/auth.server', () => ({
  requireUsernameMatch: vi.fn(),
}))

// Import after mocks are set up
import TagsPage, { loader, meta } from './tags'
import { tagService } from '~/lib/services/container.server'

const mockTagService = tagService as unknown as {
  getUserTagsWithCount: ReturnType<typeof vi.fn>
  deleteTagsWithNoPins: ReturnType<typeof vi.fn>
}

const mockTags: TagWithCount[] = [
  {
    id: '1',
    userId: 'user1',
    name: 'typescript',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    pinCount: 25,
  },
  {
    id: '2',
    userId: 'user1',
    name: 'react',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    pinCount: 15,
  },
]

describe('TagsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('meta function', () => {
    it('returns correct meta tags', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = meta({ params: { username: 'testuser' } } as any)

      expect(result).toEqual([
        {
          title: "testuser's Tags - PinSquirrel",
        },
        {
          name: 'description',
          content: 'Browse all your tags organized by usage on PinSquirrel.',
        },
      ])
    })
  })

  describe('loader function', () => {
    it('loads tags for authenticated user', async () => {
      mockTagService.getUserTagsWithCount.mockResolvedValue(mockTags)

      const request = new Request('http://localhost/testuser/tags')
      const params = { username: 'testuser' }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await loader({ request, params } as any)

      expect(result).toEqual({
        tags: mockTags,
        username: 'testuser',
        currentFilter: 'all',
        untaggedPinsCount: 0,
      })
      expect(mockTagService.getUserTagsWithCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          user: expect.objectContaining({ id: 'user1' }),
        }),
        'user1',
        undefined
      )
    })

    it('loads tags with toread filter', async () => {
      mockTagService.getUserTagsWithCount.mockResolvedValue(mockTags)

      const request = new Request('http://localhost/testuser/tags?unread=true')
      const params = { username: 'testuser' }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await loader({ request, params } as any)

      expect(result).toEqual({
        tags: mockTags,
        username: 'testuser',
        currentFilter: 'toread',
        untaggedPinsCount: 0,
      })
      expect(mockTagService.getUserTagsWithCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          user: expect.objectContaining({ id: 'user1' }),
        }),
        'user1',
        { readLater: true }
      )
    })

    it('defaults to all filter when no unread parameter', async () => {
      mockTagService.getUserTagsWithCount.mockResolvedValue(mockTags)

      const request = new Request('http://localhost/testuser/tags')
      const params = { username: 'testuser' }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await loader({ request, params } as any)

      expect(result).toEqual({
        tags: mockTags,
        username: 'testuser',
        currentFilter: 'all',
        untaggedPinsCount: 0,
      })
      expect(mockTagService.getUserTagsWithCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          user: expect.objectContaining({ id: 'user1' }),
        }),
        'user1',
        undefined
      )
    })
  })

  describe('TagsPage component', () => {
    it('renders tags page with tag cloud when tags exist', () => {
      mockLoaderData = {
        tags: mockTags,
        username: 'testuser',
        currentFilter: 'all',
        untaggedPinsCount: 0,
      }

      render(
        <BrowserRouter>
          <TagsPage />
        </BrowserRouter>
      )

      expect(screen.getByText("testuser's Tags")).toBeInTheDocument()
      expect(screen.getByText('2 tags total')).toBeInTheDocument()
      expect(screen.getByText('typescript')).toBeInTheDocument()
      expect(screen.getByText('react')).toBeInTheDocument()
    })

    it('renders empty state when no tags exist', () => {
      mockLoaderData = {
        tags: [],
        username: 'testuser',
        currentFilter: 'all',
        untaggedPinsCount: 0,
      }

      render(
        <BrowserRouter>
          <TagsPage />
        </BrowserRouter>
      )

      expect(screen.getByText("testuser's Tags")).toBeInTheDocument()
      expect(
        screen.getByText(
          'No tags yet. Tags will appear here when you add them to your pins.'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText("You haven't created any tags yet.")
      ).toBeInTheDocument()
    })

    it('shows singular tag count for single tag', () => {
      mockLoaderData = {
        tags: [mockTags[0]],
        username: 'testuser',
        currentFilter: 'all',
        untaggedPinsCount: 0,
      }

      render(
        <BrowserRouter>
          <TagsPage />
        </BrowserRouter>
      )

      expect(screen.getByText('1 tag total')).toBeInTheDocument()
    })
  })
})
