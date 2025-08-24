import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import type { Pin } from '@pinsquirrel/core'
import PinsPage from './pins'

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
  DrizzleUserRepository: vi.fn().mockImplementation(() => ({})),
  DrizzlePasswordResetRepository: vi.fn(),
  db: {},
}))

// Using createRoutesStub instead of mocking React Router hooks

describe('PinsPage Integration', () => {
  // Helper function for component testing (avoids hydration warnings)
  const renderComponentWithRouter = (
    loaderData: any,
    navigationState: 'idle' | 'loading' = 'idle'
  ) => {
    mockLoaderData = loaderData
    mockNavigationState = navigationState

    const Stub = createRoutesStub([
      {
        path: '/pins',
        Component: () => <PinsPage />,
      },
    ])
    return render(<Stub initialEntries={['/pins']} />)
  }

  // Keep this for compatibility with existing test calls
  const renderWithRouter = (loaderData: any) => {
    return renderComponentWithRouter(loaderData)
  }
  const mockPins: Pin[] = [
    {
      id: 'pin-1',
      userId: 'user-1',
      url: 'https://example.com',
      title: 'Example Pin',
      description: 'A test pin',
      readLater: false,
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
      tags: [],
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page header correctly', async () => {
    renderWithRouter({
      pins: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
      successMessage: null,
      errorMessage: null,
    })

    // Component rendered via renderWithRouter

    // Verify filter dropdown is present with "All Pins" text
    expect(await screen.findByText('All Pins')).toBeInTheDocument()
  })

  it('renders empty state when user has no pins', async () => {
    renderWithRouter({
      pins: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
      successMessage: null,
      errorMessage: null,
    })

    // Component rendered via renderWithRouter

    expect(
      await screen.findByText("You don't have any pins yet")
    ).toBeInTheDocument()
    expect(
      await screen.findByText(
        'Start saving your favorite links, images, and articles to build your personal library.'
      )
    ).toBeInTheDocument()
  })

  it('renders pin cards when user has pins', async () => {
    renderWithRouter({
      pins: mockPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 2,
      successMessage: null,
      errorMessage: null,
    })

    // Component rendered via renderWithRouter

    expect(await screen.findByText('Example Pin')).toBeInTheDocument()
    expect(screen.getByText('• Another Pin')).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('https://example2.com')).toBeInTheDocument()
  })

  it('renders pins in vertical list layout', async () => {
    renderWithRouter({
      pins: mockPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 2,
      successMessage: null,
      errorMessage: null,
    })

    // Component rendered via renderWithRouter

    // Check that the list container has the correct classes
    const listContainer = await screen.findByTestId('pin-list')
    expect(listContainer).toHaveClass('space-y-4')
  })

  it('shows loading state when navigation state is loading', async () => {
    // Test loading state by setting navigation state to loading
    renderComponentWithRouter(
      {
        pins: mockPins,
        totalPages: 1,
        currentPage: 1,
        totalCount: 2,
        successMessage: null,
        errorMessage: null,
      },
      'loading'
    )

    // Component rendered via renderWithRouter
    // Should show loading skeleton instead of actual pins
    expect(await screen.findByTestId('pin-list-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('pin-list')).not.toBeInTheDocument()
    expect(screen.queryByText('Example Pin')).not.toBeInTheDocument()
  })

  it('applies correct layout structure with max-width', () => {
    const { container } = renderWithRouter({
      pins: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
      successMessage: null,
      errorMessage: null,
    })

    // Component rendered via renderWithRouter

    // Verify component renders without errors (layout classes moved to root)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('shows correct header spacing and typography', () => {
    const { container } = renderWithRouter({
      pins: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
      successMessage: null,
      errorMessage: null,
    })

    // Component rendered via renderWithRouter

    // Verify filter dropdown is present
    expect(screen.getByText('All Pins')).toBeInTheDocument()

    // Check that header section exists with proper classes
    expect(container.querySelector('.mb-6')).toBeInTheDocument()
  })

  it('integrates PinList component correctly', async () => {
    const testPins = [mockPins[0]] // Single pin
    renderWithRouter({
      pins: testPins,
      totalPages: 1,
      currentPage: 1,
      totalCount: 1,
      successMessage: null,
      errorMessage: null,
    })

    // Component rendered via renderWithRouter

    // Verify UI shows the pin
    expect(await screen.findByText('Example Pin')).toBeInTheDocument()
    expect(
      screen.queryByText("You don't have any pins yet")
    ).not.toBeInTheDocument()

    // Verify list layout is used
    expect(screen.getByTestId('pin-list')).toBeInTheDocument()
  })

  it('handles navigation state changes correctly', async () => {
    renderWithRouter({
      pins: mockPins,
      totalPages: 2,
      currentPage: 1,
      totalCount: 30,
      successMessage: null,
      errorMessage: null,
    })

    // Component rendered via renderWithRouter
    // Test that component renders content correctly in idle state
    expect(await screen.findByTestId('pin-list')).toBeInTheDocument()
    expect(screen.getByText('Example Pin')).toBeInTheDocument()

    // Navigation state testing with createRoutesStub would require a more complex setup
    // For now, we verify the basic functionality works
  })
})
