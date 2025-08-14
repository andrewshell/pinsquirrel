import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { LoginForm } from './LoginForm'
import type { FieldErrors } from '~/lib/validation'

// Mock useFetcher for test data control
const mockUseFetcher = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    useFetcher: () => mockUseFetcher(),
  }
})

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseFetcher.mockReturnValue({
      data: undefined,
      state: 'idle',
      Form: 'form',
    })
  })

  const renderWithRouter = (
    actionData?: { errors?: FieldErrors },
    isSubmitting = false
  ) => {
    mockUseFetcher.mockReturnValue({
      data: actionData,
      state: isSubmitting ? 'submitting' : 'idle',
      Form: 'form',
    })

    const Stub = createRoutesStub([
      {
        path: '/login',
        Component: LoginForm,
      },
    ])

    return render(<Stub initialEntries={['/login']} />)
  }

  it('renders form with correct attributes and structure', () => {
    const { container } = renderWithRouter()

    const form = container.querySelector('form')
    expect(form).toHaveAttribute('method', 'post')

    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Login' })

    expect(usernameInput).toHaveAttribute('name', 'username')
    expect(usernameInput).toHaveAttribute('required')
    expect(passwordInput).toHaveAttribute('name', 'password')
    expect(passwordInput).toHaveAttribute('required')
    expect(submitButton).toHaveAttribute('type', 'submit')
  })

  it('displays form-level error message', () => {
    renderWithRouter({
      errors: { _form: 'Invalid credentials' },
    })

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('displays username field error', () => {
    renderWithRouter({
      errors: { username: 'Username is required' },
    })

    expect(screen.getByText('Username is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveClass('border-red-500')
  })

  it('displays password field error', () => {
    renderWithRouter({
      errors: { password: 'Password is required' },
    })

    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveClass('border-red-500')
  })

  it('applies correct CSS classes for valid fields', () => {
    renderWithRouter()

    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')

    expect(usernameInput).toHaveClass('border-gray-300')
    expect(passwordInput).toHaveClass('border-gray-300')
  })

  it('shows loading state when submitting', () => {
    renderWithRouter(undefined, true)

    const submitButton = screen.getByRole('button')

    expect(submitButton).toHaveTextContent('Signing in...')
    expect(submitButton).toBeDisabled()
  })
})
