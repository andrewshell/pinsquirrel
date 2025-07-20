import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'

// Simple sanity test to ensure the test suite runs
describe('Root App Sanity Tests', () => {
  it('should render without crashing', () => {
    // Create a minimal router for testing
    const router = createMemoryRouter([
      {
        path: '/',
        element: <div data-testid="app-root">App is working</div>,
      },
    ])

    render(<RouterProvider router={router} />)

    expect(screen.getByTestId('app-root')).toBeInTheDocument()
    expect(screen.getByText('App is working')).toBeInTheDocument()
  })

  it('should have access to testing utilities', () => {
    // Test that our testing environment is properly set up
    expect(true).toBe(true)
    expect(typeof render).toBe('function')
    expect(typeof screen).toBe('object')
  })

  it('should support async operations', async () => {
    // Test async functionality works in test environment
    const promise = Promise.resolve('test complete')
    const result = await promise
    expect(result).toBe('test complete')
  })
})