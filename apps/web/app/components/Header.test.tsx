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
    it('shows username as profile link', () => {
      renderWithRouter(mockUser)

      const profileLink = screen.getByRole('link', { name: 'testuser' })
      expect(profileLink).toBeInTheDocument()
      expect(profileLink).toHaveAttribute('href', '/profile')
    })

    it('shows logout button', () => {
      renderWithRouter(mockUser)

      expect(
        screen.getByRole('button', { name: 'Sign Out' })
      ).toBeInTheDocument()
    })

    it('logout form posts to /logout', () => {
      renderWithRouter(mockUser)

      const logoutForm = screen
        .getByRole('button', { name: 'Sign Out' })
        .closest('form')
      expect(logoutForm).toHaveAttribute('method', 'post')
      expect(logoutForm).toHaveAttribute('action', '/logout')
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

    it('profile link has descriptive text', () => {
      renderWithRouter(mockUser)

      const profileLink = screen.getByRole('link', { name: 'testuser' })
      expect(profileLink).toHaveClass(
        'text-base',
        'font-bold',
        'text-foreground'
      )
    })
  })
})
