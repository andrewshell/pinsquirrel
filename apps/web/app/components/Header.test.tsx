import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from './Header'
import type { User } from '@pinsquirrel/core'

// Mock React Router components
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    Form: ({
      children,
      ...props
    }: React.FormHTMLAttributes<HTMLFormElement>) => (
      <form {...props}>{children}</form>
    ),
    Link: ({
      children,
      to,
      ...props
    }: {
      children: React.ReactNode
      to: string
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

const mockUser: User = {
  id: '1',
  username: 'testuser',
  passwordHash: 'hash',
  emailHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('Header', () => {
  it('renders PinSquirrel brand logo', () => {
    render(<Header user={null} />)

    expect(screen.getByText('PinSquirrel')).toBeInTheDocument()
    expect(screen.getByAltText('PinSquirrel logo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /PinSquirrel/i })).toHaveAttribute(
      'href',
      '/'
    )
  })

  describe('when user is not logged in', () => {
    it('shows login and sign up buttons', () => {
      render(<Header user={null} />)

      expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Sign Up' })).toBeInTheDocument()
    })

    it('login link points to /login', () => {
      render(<Header user={null} />)

      expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute(
        'href',
        '/login'
      )
    })

    it('sign up link points to /register', () => {
      render(<Header user={null} />)

      expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute(
        'href',
        '/register'
      )
    })

    it('does not show user profile or logout elements', () => {
      render(<Header user={null} />)

      expect(screen.queryByText('testuser')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Logout' })
      ).not.toBeInTheDocument()
    })
  })

  describe('when user is logged in', () => {
    it('shows username as profile link', () => {
      render(<Header user={mockUser} />)

      const profileLink = screen.getByRole('link', { name: 'testuser' })
      expect(profileLink).toBeInTheDocument()
      expect(profileLink).toHaveAttribute('href', '/profile')
    })

    it('shows logout button', () => {
      render(<Header user={mockUser} />)

      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
    })

    it('logout form posts to /logout', () => {
      render(<Header user={mockUser} />)

      const logoutForm = screen
        .getByRole('button', { name: 'Logout' })
        .closest('form')
      expect(logoutForm).toHaveAttribute('method', 'post')
      expect(logoutForm).toHaveAttribute('action', '/logout')
    })

    it('does not show login and sign up buttons', () => {
      render(<Header user={mockUser} />)

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
      const { container } = render(<Header user={null} />)

      const header = container.querySelector('header')
      expect(header).toHaveClass('bg-white', 'border-b', 'border-gray-200')
    })

    it('applies correct navigation spacing for logged out state', () => {
      render(<Header user={null} />)

      const nav = screen.getByRole('navigation')
      expect(nav.querySelector('div')).toHaveClass(
        'flex',
        'items-center',
        'space-x-2'
      )
    })

    it('applies correct navigation spacing for logged in state', () => {
      render(<Header user={mockUser} />)

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
      render(<Header user={null} />)

      expect(screen.getByRole('banner')).toBeInTheDocument()
    })

    it('has proper navigation landmark', () => {
      render(<Header user={null} />)

      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('profile link has descriptive text', () => {
      render(<Header user={mockUser} />)

      const profileLink = screen.getByRole('link', { name: 'testuser' })
      expect(profileLink).toHaveClass(
        'text-sm',
        'text-gray-700',
        'hover:text-gray-900'
      )
    })
  })
})
