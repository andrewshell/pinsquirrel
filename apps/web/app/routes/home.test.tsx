import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './home'

describe('Home Page', () => {
  it('should render the main heading', () => {
    render(<Home />)
    
    expect(screen.getByText('shadcn/ui Component Test')).toBeInTheDocument()
  })

  it('should render all card components', () => {
    render(<Home />)
    
    // Check for card titles
    expect(screen.getByText('Basic Card')).toBeInTheDocument()
    expect(screen.getByText('Interactive Card')).toBeInTheDocument()
    expect(screen.getByText('Feature Showcase')).toBeInTheDocument()
    expect(screen.getByText('Statistics')).toBeInTheDocument()
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText('Minimal Style')).toBeInTheDocument()
  })

  it('should render various button variants', () => {
    render(<Home />)
    
    // Check for different button variants
    expect(screen.getByRole('button', { name: 'Default' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Destructive' })).toBeInTheDocument()
  })

  it('should display statistics correctly', () => {
    render(<Home />)
    
    expect(screen.getByText('2,543')).toBeInTheDocument()
    expect(screen.getByText('+20.1% from last month')).toBeInTheDocument()
  })

  it('should render activity list items', () => {
    render(<Home />)
    
    expect(screen.getByText('Project deployed')).toBeInTheDocument()
    expect(screen.getByText('New user registered')).toBeInTheDocument()
    expect(screen.getByText('Payment pending')).toBeInTheDocument()
  })

  it('should render color scheme test section', () => {
    render(<Home />)
    
    // Use getAllByText to handle multiple "Secondary" elements
    const backgrounds = screen.getByText('Background')
    const cards = screen.getByText('Card')  
    const primaries = screen.getByText('Primary')
    const secondaries = screen.getAllByText('Secondary')
    
    expect(backgrounds).toBeInTheDocument()
    expect(cards).toBeInTheDocument()
    expect(primaries).toBeInTheDocument()
    expect(secondaries).toHaveLength(2) // Button and color scheme section
  })
})