import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, redirect } from 'react-router'
import Home from './home'

// Mock the session server module
vi.mock('~/lib/session.server', () => ({
  getUser: vi.fn().mockResolvedValue(null),
}))

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

  it('should redirect logged-in users to pins page', async () => {
    const user = { id: '1', username: 'testuser' }
    renderWithRouter(user)

    // Should be redirected to pins page instead of seeing home content
    expect(await screen.findByTestId('pins-page')).toBeInTheDocument()
    expect(screen.queryByText('PinSquirrel Boilerplate')).not.toBeInTheDocument()
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
