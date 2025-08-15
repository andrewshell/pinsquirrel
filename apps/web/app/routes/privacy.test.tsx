import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Privacy from './privacy'

describe('Privacy Page', () => {
  it('should render the main heading', () => {
    render(<Privacy />)

    expect(
      screen.getByRole('heading', { name: 'Privacy Policy' })
    ).toBeInTheDocument()
  })

  it('should render key privacy sections', () => {
    render(<Privacy />)

    expect(
      screen.getByText("We Don't Give a Shit About Your Data")
    ).toBeInTheDocument()
    expect(screen.getByText('What We Collect')).toBeInTheDocument()
    expect(screen.getByText("What We Don't Collect")).toBeInTheDocument()
    expect(screen.getByText('Your Stuff is Safe')).toBeInTheDocument()
  })

  it('should mention email hashing process', () => {
    render(<Privacy />)

    expect(
      screen.getByText(
        /Your email address, but we immediately scramble it beyond recognition and toss the original/i
      )
    ).toBeInTheDocument()
  })

  it('should mention no creepy tracking', () => {
    render(<Privacy />)

    expect(
      screen.getByText(/Creepy tracking cookies or stalker-level analytics/)
    ).toBeInTheDocument()
  })

  it('should have contact email link', () => {
    render(<Privacy />)

    const emailLink = screen.getByRole('link', {
      name: 'andrew@pinsquirrel.com',
    })
    expect(emailLink).toBeInTheDocument()
    expect(emailLink).toHaveAttribute('href', 'mailto:andrew@pinsquirrel.com')
  })
})
