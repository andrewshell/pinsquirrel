import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Pin } from '@pinsquirrel/core'
import PinsPage from './pins'

// Mock the database repositories
const mockFindByUserId = vi.hoisted(() => vi.fn())
const mockCountByUserId = vi.hoisted(() => vi.fn())

vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn(),
}))

vi.mock('@pinsquirrel/database', () => ({
  DrizzlePinRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindByUserId,
    countByUserId: mockCountByUserId,
  })),
  DrizzleTagRepository: vi.fn().mockImplementation(() => ({})),
  db: {},
}))

interface MockLinkProps {
  to: string
  children: React.ReactNode
  className?: string
  'aria-label'?: string
}

// Mock React Router hooks
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useLoaderData: vi.fn(),
    useNavigation: vi.fn(),
    Link: ({ to, children, className, 'aria-label': ariaLabel }: MockLinkProps) => (
      <a href={to} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    ),
  }
})

import { useLoaderData, useNavigation } from 'react-router'
import type { Navigation } from 'react-router'

const mockUseLoaderData = vi.mocked(useLoaderData)
const mockUseNavigation = vi.mocked(useNavigation)

// Helper to create partial Navigation mocks
function createMockNavigation(overrides: Partial<Navigation> = {}): Navigation {
  return {
    state: 'idle',
    location: undefined,
    formMethod: undefined,
    formAction: undefined,
    formEncType: undefined,
    formData: undefined,
    json: undefined,
    text: undefined,
    ...overrides,
  } as Navigation
}

describe('PinsPage Integration', () => {
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
        { id: 'tag-1', userId: 'user-1', name: 'javascript', createdAt: new Date(), updatedAt: new Date() }
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
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock values
    mockUseNavigation.mockReturnValue(createMockNavigation())
  })

  it('renders page header correctly', () => {
    mockUseLoaderData.mockReturnValue({
      pins: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
    })

    render(<PinsPage />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My Pins')
    expect(screen.getByText('Manage your saved bookmarks, images, and articles')).toBeInTheDocument()
  })

  it('renders empty state when user has no pins', () => {
    mockUseLoaderData.mockReturnValue({
      pins: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
    })

    render(<PinsPage />)
    
    expect(screen.getByText("You don't have any pins yet")).toBeInTheDocument()
    expect(screen.getByText('Start saving your favorite links, images, and articles to build your personal library.')).toBeInTheDocument()
  })

  it('renders pin cards when user has pins', () => {
    mockUseLoaderData.mockReturnValue({
      pins: mockPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 2,
    })

    render(<PinsPage />)
    
    expect(screen.getByText('Example Pin')).toBeInTheDocument()
    expect(screen.getByText('Another Pin')).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('https://example2.com')).toBeInTheDocument()
  })

  it('renders pins in vertical list layout', () => {
    mockUseLoaderData.mockReturnValue({
      pins: mockPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 2,
    })

    render(<PinsPage />)
    
    // Check that the list container has the correct classes
    const listContainer = screen.getByTestId('pin-list')
    expect(listContainer).toHaveClass('space-y-4')
  })

  it('shows loading state when navigation state is loading', () => {
    mockUseLoaderData.mockReturnValue({
      pins: mockPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 2,
    })

    mockUseNavigation.mockReturnValue(createMockNavigation({ state: 'loading' }))

    render(<PinsPage />)
    
    // Should show loading skeleton instead of actual pins
    expect(screen.getByTestId('pin-list-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('pin-list')).not.toBeInTheDocument()
    expect(screen.queryByText('Example Pin')).not.toBeInTheDocument()
  })

  it('applies correct layout structure with max-width', () => {
    mockUseLoaderData.mockReturnValue({
      pins: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
    })

    render(<PinsPage />)

    // Check main container structure - traverse from h1 -> div -> div -> div
    const titleElement = screen.getByText('My Pins')  // h1 element
    const titleWrapper = titleElement.parentElement   // div wrapper for title
    const headerContainer = titleWrapper?.parentElement  // mb-8 flex div
    const mainContainer = headerContainer?.parentElement  // max-w-7xl mx-auto div
    expect(mainContainer).toHaveClass('max-w-7xl', 'mx-auto', 'px-4', 'sm:px-6', 'lg:px-8')
    
    const pageContainer = mainContainer?.parentElement
    expect(pageContainer).toHaveClass('min-h-screen', 'bg-background', 'py-12')
  })

  it('shows correct header spacing and typography', () => {
    mockUseLoaderData.mockReturnValue({
      pins: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
    })

    render(<PinsPage />)

    // Find the header section (mb-8 flex div) - traverse from h1 -> div -> div
    const titleElement = screen.getByText('My Pins')  // h1 element
    const titleWrapper = titleElement.parentElement   // div wrapper for title
    const headerSection = titleWrapper?.parentElement  // mb-8 flex div
    expect(headerSection).toHaveClass('mb-8')
    
    const title = screen.getByRole('heading', { level: 1 })
    expect(title).toHaveClass('text-3xl', 'font-bold', 'text-foreground')
    
    const subtitle = screen.getByText('Manage your saved bookmarks, images, and articles')
    expect(subtitle).toHaveClass('mt-2', 'text-muted-foreground')
  })

  it('integrates PinList component correctly', () => {
    const testPins = [mockPins[0]] // Single pin
    mockUseLoaderData.mockReturnValue({
      pins: testPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 1,
    })

    render(<PinsPage />)
    
    // Verify UI shows the pin
    expect(screen.getByText('Example Pin')).toBeInTheDocument()
    expect(screen.queryByText("You don't have any pins yet")).not.toBeInTheDocument()
    
    // Verify list layout is used
    expect(screen.getByTestId('pin-list')).toBeInTheDocument()
  })

  it('handles navigation state changes correctly', () => {
    mockUseLoaderData.mockReturnValue({
      pins: mockPins,
      totalPages: 2,
      currentPage: 1,
      totalCount: 30,
    })

    // Test idle state first
    mockUseNavigation.mockReturnValue(createMockNavigation({ state: 'idle' }))

    const { rerender } = render(<PinsPage />)
    
    // Should show actual content
    expect(screen.getByTestId('pin-list')).toBeInTheDocument()
    expect(screen.getByText('Example Pin')).toBeInTheDocument()

    // Change to loading state
    mockUseNavigation.mockReturnValue(createMockNavigation({ state: 'loading' }))

    rerender(<PinsPage />)
    
    // Should show loading state
    expect(screen.getByTestId('pin-list-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('pin-list')).not.toBeInTheDocument()
  })
})