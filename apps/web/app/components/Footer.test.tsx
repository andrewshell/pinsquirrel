import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Footer } from './Footer'

function renderWithRouter() {
  const routes = [
    {
      path: '/',
      element: <Footer />,
    },
    {
      path: '/privacy',
      element: <div data-testid="privacy-page">Privacy Page</div>,
    },
    {
      path: '/terms',
      element: <div data-testid="terms-page">Terms Page</div>,
    },
  ]

  const router = createMemoryRouter(routes, {
    initialEntries: ['/'],
  })

  return render(<RouterProvider router={router} />)
}

describe('Footer', () => {
  it('should render copyright notice with current year', () => {
    renderWithRouter()

    const currentYear = new Date().getFullYear()
    expect(
      screen.getByText(`© ${currentYear} Andrew Shell LLC.`)
    ).toBeInTheDocument()
    expect(screen.getByText('All rights reserved.')).toBeInTheDocument()
  })

  it('should render privacy policy link', () => {
    renderWithRouter()

    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' })
    expect(privacyLink).toBeInTheDocument()
    expect(privacyLink).toHaveAttribute('href', '/privacy')
  })

  it('should render terms of use link', () => {
    renderWithRouter()

    const termsLink = screen.getByRole('link', { name: 'Terms of Use' })
    expect(termsLink).toBeInTheDocument()
    expect(termsLink).toHaveAttribute('href', '/terms')
  })
})
