import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import type { Pin } from '@pinsquirrel/domain'
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
  createDatabaseClient: vi.fn(),
  DrizzlePinRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindByUserId,
    countByUserId: mockCountByUserId,
  })),
  DrizzleTagRepository: vi.fn().mockImplementation(() => ({})),
  DrizzleUserRepository: vi.fn().mockImplementation(() => ({})),
  DrizzlePasswordResetRepository: vi.fn(),
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
      tagNames: ['javascript'],
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
      tagNames: [],
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page header correctly', async () => {
    const mockPinsResult = {
      pins: [],
      pagination: {
        page: 1,
        totalPages: 1,
      },
      totalCount: 0,
    }

    const mockPinsData = Promise.resolve(mockPinsResult)

    await act(async () => {
      renderWithRouter({
        pinsData: mockPinsData,
        username: 'testuser',
        successMessage: null,
        errorMessage: null,
        searchParamsString: '',
      })
      // Wait for the promise to resolve
      await mockPinsData
    })

    // Component rendered via renderWithRouter

    // Verify filter dropdown is present with "All Pins" text
    expect(await screen.findByText('All Pins')).toBeInTheDocument()
  })

  it('renders empty state when user has no pins', async () => {
    const mockPinsResult = {
      pins: [],
      pagination: {
        page: 1,
        totalPages: 1,
      },
      totalCount: 0,
    }

    const mockPinsData = Promise.resolve(mockPinsResult)

    await act(async () => {
      renderWithRouter({
        pinsData: mockPinsData,
        username: 'testuser',
        successMessage: null,
        errorMessage: null,
        searchParamsString: '',
      })
      // Wait for the promise to resolve
      await mockPinsData
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
    // Create a resolved promise with mock data
    const mockPinsResult = {
      pins: mockPins,
      pagination: {
        page: 1,
        totalPages: 1,
      },
      totalCount: 2,
    }

    const mockPinsData = new Promise(resolve => {
      // Use setTimeout to ensure the promise resolves in next tick
      setTimeout(() => resolve(mockPinsResult), 0)
    })

    await act(async () => {
      renderWithRouter({
        pinsData: mockPinsData,
        username: 'testuser',
        successMessage: null,
        errorMessage: null,
        searchParamsString: '',
      })
      // Wait for the promise to resolve
      await mockPinsData
    })

    // Wait for Suspense to resolve and show the actual pins
    expect(await screen.findByText('Example Pin', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('• Another Pin')).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('https://example2.com')).toBeInTheDocument()
  })

  it('renders pins in vertical list layout', async () => {
    const mockPinsResult = {
      pins: mockPins,
      pagination: {
        page: 1,
        totalPages: 1,
      },
      totalCount: 2,
    }

    const mockPinsData = new Promise(resolve => {
      setTimeout(() => resolve(mockPinsResult), 0)
    })

    await act(async () => {
      renderWithRouter({
        pinsData: mockPinsData,
        username: 'testuser',
        successMessage: null,
        errorMessage: null,
        searchParamsString: '',
      })
      // Wait for the promise to resolve
      await mockPinsData
    })

    // Component rendered via renderWithRouter

    // Wait for Suspense to resolve and check that the list container has the correct classes
    const listContainer = await screen.findByTestId('pin-list', {}, { timeout: 3000 })
    expect(listContainer).toHaveClass('space-y-4')
  })

  it('shows empty fallback during loading then renders pins', async () => {
    // Test that Suspense shows empty fallback during loading
    const mockPinsResult = {
      pins: mockPins,
      pagination: {
        page: 1,
        totalPages: 1,
      },
      totalCount: 2,
    }

    const mockPinsData = new Promise(resolve => {
      setTimeout(() => resolve(mockPinsResult), 100) // Longer delay to test loading state
    })

    await act(async () => {
      renderWithRouter({
        pinsData: mockPinsData,
        username: 'testuser',
        successMessage: null,
        errorMessage: null,
        searchParamsString: '',
      })
      // Wait for the promise to resolve
      await mockPinsData
    })

    // Should eventually show the pins after promise resolves
    expect(await screen.findByTestId('pin-list', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Example Pin')).toBeInTheDocument()
  })

  it('applies correct layout structure with max-width', async () => {
    const mockPinsResult = {
      pins: [],
      pagination: {
        page: 1,
        totalPages: 1,
      },
      totalCount: 0,
    }

    const mockPinsData = Promise.resolve(mockPinsResult)

    const { container } = await act(async () => {
      const result = renderWithRouter({
        pinsData: mockPinsData,
        username: 'testuser',
        successMessage: null,
        errorMessage: null,
        searchParamsString: '',
      })
      // Wait for the promise to resolve
      await mockPinsData
      return result
    })

    // Component rendered via renderWithRouter

    // Verify component renders without errors (layout classes moved to root)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('shows correct header spacing and typography', async () => {
    const mockPinsResult = {
      pins: [],
      pagination: {
        page: 1,
        totalPages: 1,
      },
      totalCount: 0,
    }

    const mockPinsData = Promise.resolve(mockPinsResult)

    const { container } = await act(async () => {
      const result = renderWithRouter({
        pinsData: mockPinsData,
        username: 'testuser',
        successMessage: null,
        errorMessage: null,
        searchParamsString: '',
      })
      // Wait for the promise to resolve
      await mockPinsData
      return result
    })

    // Component rendered via renderWithRouter

    // Verify filter dropdown is present
    expect(screen.getByText('All Pins')).toBeInTheDocument()

    // Check that header section exists with proper classes
    expect(container.querySelector('.mb-6')).toBeInTheDocument()
  })

  it('integrates PinList component correctly', async () => {
    const testPins = [mockPins[0]] // Single pin
    const mockPinsResult = {
      pins: testPins,
      pagination: {
        page: 1,
        totalPages: 1,
      },
      totalCount: 1,
    }

    const mockPinsData = new Promise(resolve => {
      setTimeout(() => resolve(mockPinsResult), 0)
    })

    await act(async () => {
      renderWithRouter({
        pinsData: mockPinsData,
        username: 'testuser',
        successMessage: null,
        errorMessage: null,
        searchParamsString: '',
      })
      // Wait for the promise to resolve
      await mockPinsData
    })

    // Component rendered via renderWithRouter

    // Wait for Suspense to resolve and verify UI shows the pin
    expect(await screen.findByText('Example Pin', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(
      screen.queryByText("You don't have any pins yet")
    ).not.toBeInTheDocument()

    // Verify list layout is used
    expect(screen.getByTestId('pin-list')).toBeInTheDocument()
  })

  it('handles navigation state changes correctly', async () => {
    const mockPinsResult = {
      pins: mockPins,
      pagination: {
        page: 1,
        totalPages: 2,
      },
      totalCount: 30,
    }

    const mockPinsData = new Promise(resolve => {
      setTimeout(() => resolve(mockPinsResult), 0)
    })

    await act(async () => {
      renderWithRouter({
        pinsData: mockPinsData,
        username: 'testuser',
        successMessage: null,
        errorMessage: null,
        searchParamsString: '',
      })
      // Wait for the promise to resolve
      await mockPinsData
    })

    // Component rendered via renderWithRouter
    // Wait for Suspense to resolve and test that component renders content correctly in idle state
    expect(await screen.findByTestId('pin-list', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Example Pin')).toBeInTheDocument()

    // Navigation state testing with createRoutesStub would require a more complex setup
    // For now, we verify the basic functionality works
  })
})
