import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import type { Pin } from '@pinsquirrel/core'
import ToReadPage from './toread'

// We need to mock the React Router hooks for this integration test
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
let mockLoaderData: any = {}
let mockNavigationState: 'idle' | 'loading' = 'idle'

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useLoaderData: () => mockLoaderData,
    useNavigation: () => ({ state: mockNavigationState }),
  }
})

// Mock the database repositories
const mockFindByUserIdWithFilter = vi.hoisted(() => vi.fn())
const mockCountByUserIdWithFilter = vi.hoisted(() => vi.fn())

vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn(),
  getSession: vi.fn(),
  commitSession: vi.fn(),
}))

vi.mock('@pinsquirrel/database', () => ({
  DrizzlePinRepository: vi.fn().mockImplementation(() => ({
    findByUserIdWithFilter: mockFindByUserIdWithFilter,
    countByUserIdWithFilter: mockCountByUserIdWithFilter,
  })),
  DrizzleTagRepository: vi.fn().mockImplementation(() => ({})),
  DrizzleUserRepository: vi.fn().mockImplementation(() => ({})),
  DrizzlePasswordResetRepository: vi.fn(),
  db: {},
}))

describe('ToReadPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoaderData = {}
    mockNavigationState = 'idle'
  })

  // Helper function for component testing (avoids hydration warnings)
  const renderComponentWithRouter = (
    loaderData: any,
    navigationState: 'idle' | 'loading' = 'idle'
  ) => {
    mockLoaderData = loaderData
    mockNavigationState = navigationState

    const Stub = createRoutesStub([
      {
        path: '/toread',
        Component: () => <ToReadPage />,
      },
    ])
    return render(<Stub initialEntries={['/toread']} />)
  }

  const mockToReadPins: Pin[] = [
    {
      id: 'pin-1',
      userId: 'user-1',
      url: 'https://example.com',
      title: 'To Read Pin',
      description: 'A pin marked for reading later',
      readLater: true,
      tags: [
        {
          id: 'tag-1',
          userId: 'user-1',
          name: 'article',
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
      title: 'Another To Read Pin',
      description: null,
      readLater: true,
      tags: [],
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
    },
  ]

  it('renders pins to read page with pins', () => {
    const loaderData = {
      pins: mockToReadPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 2,
      currentFilter: 'toread',
      username: 'testuser',
      successMessage: null,
      errorMessage: null,
    }

    renderComponentWithRouter(loaderData, 'idle')

    // Check that we don't get empty state when pins exist
    expect(
      screen.queryByText(/You don't have any pins yet/i)
    ).not.toBeInTheDocument()

    // Check that pins are rendered - look for pin URLs instead of titles which might be nested
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('https://example2.com')).toBeInTheDocument()
  })

  it('shows empty state when no to read pins exist', () => {
    const loaderData = {
      pins: [],
      totalPages: 0,
      currentPage: 1,
      totalCount: 0,
      currentFilter: 'toread',
      username: 'testuser',
      successMessage: null,
      errorMessage: null,
    }

    renderComponentWithRouter(loaderData)

    // Should show empty state message
    expect(screen.getByText(/You don't have any pins yet/i)).toBeInTheDocument()
  })

  it('displays filter component for navigation between all and to read', () => {
    const loaderData = {
      pins: mockToReadPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 2,
      currentFilter: 'toread',
      username: 'testuser',
      successMessage: null,
      errorMessage: null,
    }

    renderComponentWithRouter(loaderData, 'idle')

    // Filter buttons should be present for navigation
    const allButton = screen.getByRole('link', { name: 'All' })
    const toReadButton = screen.getByRole('link', { name: 'To Read' })

    expect(allButton).toBeInTheDocument()
    expect(toReadButton).toBeInTheDocument()

    // To Read should be the active filter (would have different styling)
    expect(toReadButton).toHaveClass('bg-primary')
  })

  it('shows success message when present', () => {
    const loaderData = {
      pins: [],
      totalPages: 0,
      currentPage: 1,
      totalCount: 0,
      currentFilter: 'toread',
      username: 'testuser',
      successMessage: 'Pin saved successfully!',
      errorMessage: null,
    }

    renderComponentWithRouter(loaderData)

    expect(screen.getByText('Pin saved successfully!')).toBeInTheDocument()
  })

  it('shows error message when present', () => {
    const loaderData = {
      pins: [],
      totalPages: 0,
      currentPage: 1,
      totalCount: 0,
      currentFilter: 'toread',
      username: 'testuser',
      successMessage: null,
      errorMessage: 'Something went wrong!',
    }

    renderComponentWithRouter(loaderData)

    expect(screen.getByText('Something went wrong!')).toBeInTheDocument()
  })

  it('shows loading state correctly', () => {
    const loaderData = {
      pins: mockToReadPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 2,
      currentFilter: 'toread',
      username: 'testuser',
      successMessage: null,
      errorMessage: null,
    }

    renderComponentWithRouter(loaderData, 'loading')

    // PinList component should receive isLoading prop and show loading skeleton
    // This would be tested by the component's loading behavior
    expect(screen.getByTestId('pin-list-loading')).toBeInTheDocument()
    expect(screen.queryByText('To Read Pin')).not.toBeInTheDocument()
  })

  it('includes create pin button with correct navigation', () => {
    const loaderData = {
      pins: [],
      totalPages: 0,
      currentPage: 1,
      totalCount: 0,
      currentFilter: 'toread',
      username: 'testuser',
      successMessage: null,
      errorMessage: null,
    }

    renderComponentWithRouter(loaderData, 'idle')

    const createButton = screen.getByRole('link', { name: /Create Pin/i })
    expect(createButton).toBeInTheDocument()
    // Should navigate to new route
    expect(createButton).toHaveAttribute('href', '/testuser/pins/new')
  })

  it('renders pagination when multiple pages exist', () => {
    const loaderData = {
      pins: mockToReadPins,
      totalPages: 3,
      currentPage: 2,
      totalCount: 75,
      currentFilter: 'toread',
      username: 'testuser',
      successMessage: null,
      errorMessage: null,
    }

    renderComponentWithRouter(loaderData)

    // Should show pagination component
    expect(screen.getByText('Page 2 of 3 (75 total pins)')).toBeInTheDocument()
  })
})
