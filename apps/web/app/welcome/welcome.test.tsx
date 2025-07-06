import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Welcome } from './welcome'

describe('Welcome', () => {
  it('renders the navigation section', () => {
    render(<Welcome />)
    
    expect(screen.getByText("What's next?")).toBeInTheDocument()
  })

  it('contains React Router documentation link', () => {
    render(<Welcome />)
    
    const docsLink = screen.getByRole('link', { name: /react router docs/i })
    expect(docsLink).toHaveAttribute('href', 'https://reactrouter.com/docs')
  })

  it('contains Discord join link', () => {
    render(<Welcome />)
    
    const discordLink = screen.getByRole('link', { name: /join discord/i })
    expect(discordLink).toHaveAttribute('href', 'https://rmx.as/discord')
  })

  it('has React Router logo alt text', () => {
    render(<Welcome />)
    
    const logos = screen.getAllByAltText('React Router')
    expect(logos).toHaveLength(2) // Light and dark mode versions
  })
})