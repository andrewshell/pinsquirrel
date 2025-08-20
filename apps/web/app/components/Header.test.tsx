import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { Header } from './Header'
import type { User } from '@pinsquirrel/core'

const mockUser: User = {
  id: '1',
  username: 'testuser',
  passwordHash: 'hash',
  emailHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('Header', () => {
  const createHeaderStub = (user: User | null) => {
    return createRoutesStub([
      {
        path: '/',
        Component: () => <Header user={user} />,
        action: () => null,
      },
    ])
  }

  const renderWithRouter = (user: User | null) => {
    const Stub = createHeaderStub(user)
    return render(<Stub initialEntries={['/']} />)
  }

  it('renders PinSquirrel brand logo', () => {
    renderWithRouter(null)

    expect(screen.getByText('PinSquirrel')).toBeInTheDocument()
    expect(screen.getByAltText('PinSquirrel logo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /PinSquirrel/i })).toHaveAttribute(
      'href',
      '/'
    )
  })

  describe('when user is not logged in', () => {
    it('shows login and sign up buttons', () => {
      renderWithRouter(null)

      expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Sign Up' })).toBeInTheDocument()
    })

    it('login link points to /signin', () => {
      renderWithRouter(null)

      expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute(
        'href',
        '/signin'
      )
    })

    it('sign up link points to /signup', () => {
      renderWithRouter(null)

      expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute(
        'href',
        '/signup'
      )
    })

    it('does not show user profile or logout elements', () => {
      renderWithRouter(null)

      expect(screen.queryByText('testuser')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Sign Out' })
      ).not.toBeInTheDocument()
    })
  })

  describe('when user is logged in', () => {
    it('shows username in dropdown menu button', () => {
      renderWithRouter(mockUser)

      const userMenuButton = screen.getByRole('button', { name: /testuser/ })
      expect(userMenuButton).toBeInTheDocument()
    })

    it('has user menu button instead of separate profile link', () => {
      renderWithRouter(mockUser)

      // Should have user menu button
      const userMenuButton = screen.getByRole('button', { name: /testuser/ })
      expect(userMenuButton).toBeInTheDocument()

      // Should not have the old direct profile link (the new one is in dropdown)
      expect(
        screen.queryByRole('link', { name: 'testuser' })
      ).not.toBeInTheDocument()
    })

    it('does not show login and sign up buttons', () => {
      renderWithRouter(mockUser)

      expect(
        screen.queryByRole('link', { name: 'Sign In' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Sign Up' })
      ).not.toBeInTheDocument()
    })
  })

  describe('styling and layout', () => {
    it('applies correct header classes', () => {
      const { container } = renderWithRouter(null)

      const header = container.querySelector('header')
      expect(header).toHaveClass(
        'bg-background',
        'border-b-4',
        'border-foreground'
      )
    })

    it('applies correct navigation spacing for logged out state', () => {
      renderWithRouter(null)

      const nav = screen.getByRole('navigation')
      expect(nav.querySelector('div')).toHaveClass(
        'flex',
        'items-center',
        'space-x-2'
      )
    })

    it('applies correct navigation spacing for logged in state', () => {
      renderWithRouter(mockUser)

      const nav = screen.getByRole('navigation')
      expect(nav.querySelector('div')).toHaveClass(
        'flex',
        'items-center',
        'space-x-4'
      )
    })
  })

  describe('accessibility', () => {
    it('has proper header landmark', () => {
      renderWithRouter(null)

      expect(screen.getByRole('banner')).toBeInTheDocument()
    })

    it('has proper navigation landmark', () => {
      renderWithRouter(null)

      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('user menu button has descriptive text', () => {
      renderWithRouter(mockUser)

      const userMenuButton = screen.getByRole('button', { name: /testuser/ })
      expect(userMenuButton).toBeInTheDocument()
    })
  })
})
