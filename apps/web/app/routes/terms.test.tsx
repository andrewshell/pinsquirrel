import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Terms from './terms'

describe('Terms Page', () => {
  it('should render the main heading', () => {
    render(<Terms />)

    expect(
      screen.getByRole('heading', { name: 'Terms of Use' })
    ).toBeInTheDocument()
  })

  it('should render key terms sections', () => {
    render(<Terms />)

    expect(screen.getByText('Acceptance of Terms')).toBeInTheDocument()
    expect(screen.getByText('Service Description')).toBeInTheDocument()
    expect(screen.getByText('Acceptable Use')).toBeInTheDocument()
    expect(screen.getByText('Your Data')).toBeInTheDocument()
  })

  it('should describe the service', () => {
    render(<Terms />)

    expect(
      screen.getByText(/PinSquirrel is a bookmark management service/i)
    ).toBeInTheDocument()
  })

  it('should mention data ownership', () => {
    render(<Terms />)

    expect(
      screen.getByText(/You retain ownership of the content you save/i)
    ).toBeInTheDocument()
  })

  it('should have contact email link', () => {
    render(<Terms />)

    const emailLink = screen.getByRole('link', {
      name: 'andrew@pinsquirrel.com',
    })
    expect(emailLink).toBeInTheDocument()
    expect(emailLink).toHaveAttribute('href', 'mailto:andrew@pinsquirrel.com')
  })
})
