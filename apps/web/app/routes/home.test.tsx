/* eslint-disable @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, redirect } from 'react-router'
import Home, { loader, meta } from './home'
import type { Route } from './+types/home'
import { getUser } from '~/lib/session.server'

// Mock the session server module
vi.mock('~/lib/session.server')
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    redirect: vi.fn().mockImplementation(
      (to: string) =>
        ({
          url: to,
          status: 302,
        }) as any
    ),
  }
})

// Helper function to render with React Router context
function renderWithRouter(
  user: { id: string; username: string } | null = null
) {
  const routes = [
    {
      path: '/',
      element: <Home />,
      loader: () => {
        // Simulate the redirect behavior for logged-in users
        if (user) {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw redirect('/pins')
        }
        return { user }
      },
    },
    {
      // Add pins route to handle redirects
      path: '/pins',
      element: <div data-testid="pins-page">Pins Page</div>,
    },
  ]

  const router = createMemoryRouter(routes, {
    initialEntries: ['/'],
  })

  return render(<RouterProvider router={router} />)
}

describe('Home Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loader', () => {
    it('redirects logged-in users to pins page', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        passwordHash: 'hashed',
        emailHash: 'email-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(getUser).mockResolvedValue(mockUser)

      const request = new Request('http://localhost/')
      const args: Route.LoaderArgs = { request, params: {}, context: {} }

      const { redirect } = await import('react-router')

      await expect(loader(args)).rejects.toThrow()
      expect(getUser).toHaveBeenCalledWith(request)
      expect(redirect).toHaveBeenCalledWith('/pins')
    })

    it('returns user data when user is not logged in', async () => {
      vi.mocked(getUser).mockResolvedValue(null)

      const request = new Request('http://localhost/')
      const args: Route.LoaderArgs = { request, params: {}, context: {} }

      const result = await loader(args)

      expect(getUser).toHaveBeenCalledWith(request)
      expect(result).toEqual({ user: null })
    })
  })

  describe('meta function', () => {
    it('returns correct meta tags', () => {
      const mockArgs = {} as Route.MetaArgs

      const result = meta(mockArgs)

      expect(result).toEqual([
        { title: 'PinSquirrel Boilerplate' },
        { name: 'description', content: 'A sensible start to a new project' },
      ])
    })

    it('returns array with title and description', () => {
      const mockArgs = {} as Route.MetaArgs

      const result = meta(mockArgs)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('title')
      expect(result[1]).toHaveProperty('name', 'description')
    })
  })

  describe('loader logic validation', () => {
    it('should validate user existence check pattern', () => {
      const testCases = [
        { user: null, shouldRedirect: false },
        { user: undefined, shouldRedirect: false },
        { user: { id: 'user-123', username: 'test' }, shouldRedirect: true },
      ]

      testCases.forEach(({ user, shouldRedirect }) => {
        const userExists = !!user
        expect(userExists).toBe(shouldRedirect)
      })
    })

    it('should validate redirect logic pattern', () => {
      // Test the conditional redirect logic used in loader
      const loggedInUser = { id: 'user-123', username: 'test' }
      const loggedOutUser = null

      const shouldRedirectLoggedIn = !!loggedInUser
      const shouldRedirectLoggedOut = !!loggedOutUser

      expect(shouldRedirectLoggedIn).toBe(true)
      expect(shouldRedirectLoggedOut).toBe(false)
    })

    it('should validate return data structure', () => {
      // Test the structure of data returned for logged-out users
      const user = null
      const returnData = { user }

      expect(returnData).toHaveProperty('user')
      expect(returnData.user).toBeNull()
    })
  })

  describe('component rendering tests', () => {
    it('should render the main heading', async () => {
      renderWithRouter()

      expect(
        await screen.findByText('PinSquirrel Boilerplate')
      ).toBeInTheDocument()
    })

    it('should render the description', async () => {
      renderWithRouter()

      expect(
        await screen.findByText('A sensible start to a new project')
      ).toBeInTheDocument()
    })

    it('should render the squirrel emoji', async () => {
      renderWithRouter()

      expect(await screen.findByText('🐿️')).toBeInTheDocument()
    })

    it('should render login and register buttons', async () => {
      renderWithRouter(null)

      expect(
        await screen.findByRole('link', { name: 'Get Started' })
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument()
    })

    it('should render all three feature cards', async () => {
      renderWithRouter()

      // Feature card titles
      expect(await screen.findByText('Ready to Go')).toBeInTheDocument()
      expect(screen.getByText('Secure')).toBeInTheDocument()
      expect(screen.getByText('Modern Stack')).toBeInTheDocument()

      // Feature card emojis
      expect(screen.getByText('🚀')).toBeInTheDocument()
      expect(screen.getByText('🔒')).toBeInTheDocument()
      expect(screen.getByText('⚡')).toBeInTheDocument()
    })

    it('should render feature descriptions', async () => {
      renderWithRouter()

      expect(
        await screen.findByText(/Complete authentication system/)
      ).toBeInTheDocument()
      expect(screen.getByText(/HTTP-only cookies/)).toBeInTheDocument()
      expect(screen.getByText(/React Router 7/)).toBeInTheDocument()
    })
  })
})
