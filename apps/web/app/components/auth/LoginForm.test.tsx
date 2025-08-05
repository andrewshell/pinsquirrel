import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSubmit, useActionData } from 'react-router'
import { LoginForm } from './LoginForm'

// Mock React Router hooks
vi.mock('react-router', () => ({
  useSubmit: vi.fn(),
  useActionData: vi.fn(),
}))

describe('LoginForm', () => {
  const mockSubmit = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSubmit).mockReturnValue(mockSubmit)
    vi.mocked(useActionData).mockReturnValue(undefined)
  })

  it('renders login form with all fields', () => {
    render(<LoginForm />)
    
    expect(screen.getAllByText('Login')).toHaveLength(2) // Title and button
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('updates username field when typed', () => {
    render(<LoginForm />)
    
    const usernameInput = screen.getByLabelText('Username')
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    
    expect(usernameInput).toHaveValue('testuser')
  })

  it('updates password field when typed', () => {
    render(<LoginForm />)
    
    const passwordInput = screen.getByLabelText('Password')
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })
    
    expect(passwordInput).toHaveValue('testpass')
  })

  it('submits form with username and password', async () => {
    render(<LoginForm />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Login' })
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.any(FormData),
        { method: 'post' }
      )
    })
    
    // Verify FormData contents
    const [[formData]] = mockSubmit.mock.calls
    expect((formData as FormData).get('username')).toBe('testuser')
    expect((formData as FormData).get('password')).toBe('testpass')
  })

  it('displays form-level error message', () => {
    vi.mocked(useActionData).mockReturnValue({
      errors: { _form: 'Invalid credentials' }
    })
    
    render(<LoginForm />)
    
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('displays username field error', () => {
    vi.mocked(useActionData).mockReturnValue({
      errors: { username: 'Username is required' }
    })
    
    render(<LoginForm />)
    
    expect(screen.getByText('Username is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveClass('border-red-500')
  })

  it('displays password field error', () => {
    vi.mocked(useActionData).mockReturnValue({
      errors: { password: 'Password is required' }
    })
    
    render(<LoginForm />)
    
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveClass('border-red-500')
  })

  it('applies correct CSS classes for valid fields', () => {
    render(<LoginForm />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    
    expect(usernameInput).toHaveClass('border-gray-300')
    expect(passwordInput).toHaveClass('border-gray-300')
  })

})