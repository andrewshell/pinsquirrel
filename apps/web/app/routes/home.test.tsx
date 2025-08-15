/* eslint-disable @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import Home, { loader } from './home'
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

// Helper function for component testing (avoids hydration warnings)
function renderComponentWithRouter() {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => <Home />,
    },
  ])
  return render(<Stub initialEntries={['/']} />)
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

  describe('component rendering tests', () => {
    it('should render the main heading', async () => {
      renderComponentWithRouter()

      expect(await screen.findByText('PinSquirrel')).toBeInTheDocument()
    })

    it('should render the description', async () => {
      renderComponentWithRouter()

      expect(
        await screen.findByText(
          /Stop pretending you.*ll ever organize your bookmarks/
        )
      ).toBeInTheDocument()
    })

    it('should render the logo', async () => {
      renderComponentWithRouter()

      expect(await screen.findByAltText('PinSquirrel logo')).toBeInTheDocument()
    })

    it('should render login and register buttons', async () => {
      renderComponentWithRouter()

      expect(
        await screen.findByRole('link', { name: 'Get Started' })
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument()
    })

    it('should render all three feature cards', async () => {
      renderComponentWithRouter()

      // Feature card titles
      expect(await screen.findByText('Hoard Everything')).toBeInTheDocument()
      expect(screen.getByText('Find Your Shit')).toBeInTheDocument()
      expect(screen.getByText('Your Secret Stash')).toBeInTheDocument()

      // Feature card illustrations
      expect(
        screen.getByAltText('Person holding boxes illustration')
      ).toBeInTheDocument()
      expect(
        screen.getByAltText('Dung beetle illustration')
      ).toBeInTheDocument()
      expect(
        screen.getByAltText('Incognito figure illustration')
      ).toBeInTheDocument()
    })

    it('should render feature descriptions', async () => {
      renderComponentWithRouter()

      expect(
        await screen.findByText(/Links, images, articles, markdown/)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Our search doesn.*t judge your 3am research spirals/)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/We don.*t care what you.*re hoarding/)
      ).toBeInTheDocument()
    })
  })
})
