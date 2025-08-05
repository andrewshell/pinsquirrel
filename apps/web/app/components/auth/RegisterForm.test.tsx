import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSubmit, useActionData } from 'react-router'
import { RegisterForm } from './RegisterForm'

// Mock React Router hooks
vi.mock('react-router', () => ({
  useSubmit: vi.fn(),
  useActionData: vi.fn(),
}))

describe('RegisterForm', () => {
  const mockSubmit = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSubmit).mockReturnValue(mockSubmit)
    vi.mocked(useActionData).mockReturnValue(undefined)
  })

  it('renders registration form with all fields', () => {
    render(<RegisterForm />)
    
    expect(screen.getAllByText('Sign Up')).toHaveLength(2) // Title and button
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Email (optional)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument()
  })

  it('updates form fields when typed', () => {
    render(<RegisterForm />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const emailInput = screen.getByLabelText('Email (optional)')
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    
    expect(usernameInput).toHaveValue('testuser')
    expect(passwordInput).toHaveValue('testpass')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('submits form with all fields including email', async () => {
    render(<RegisterForm />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const emailInput = screen.getByLabelText('Email (optional)')
    const submitButton = screen.getByRole('button', { name: 'Sign Up' })
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
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
    expect((formData as FormData).get('email')).toBe('test@example.com')
  })

  it('submits form without email when email is empty', async () => {
    render(<RegisterForm />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign Up' })
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled()
    })
    
    const [[formData]] = mockSubmit.mock.calls
    expect((formData as FormData).get('username')).toBe('testuser')
    expect((formData as FormData).get('password')).toBe('testpass')
    expect((formData as FormData).get('email')).toBe(null)
  })

  it('trims whitespace from email before submitting', async () => {
    render(<RegisterForm />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const emailInput = screen.getByLabelText('Email (optional)')
    const submitButton = screen.getByRole('button', { name: 'Sign Up' })
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })
    fireEvent.change(emailInput, { target: { value: '  test@example.com  ' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled()
    })
    
    const [[formData]] = mockSubmit.mock.calls
    expect((formData as FormData).get('email')).toBe('test@example.com')
  })

  it('does not submit email when only whitespace', async () => {
    render(<RegisterForm />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const emailInput = screen.getByLabelText('Email (optional)')
    const submitButton = screen.getByRole('button', { name: 'Sign Up' })
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })
    fireEvent.change(emailInput, { target: { value: '   ' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled()
    })
    
    const [[formData]] = mockSubmit.mock.calls
    expect((formData as FormData).get('email')).toBe(null)
  })

  it('displays form-level error message', () => {
    vi.mocked(useActionData).mockReturnValue({
      errors: { _form: 'Username already exists' }
    })
    
    render(<RegisterForm />)
    
    expect(screen.getByText('Username already exists')).toBeInTheDocument()
  })

  it('displays field-specific error messages', () => {
    vi.mocked(useActionData).mockReturnValue({
      errors: {
        username: 'Username is required',
        password: 'Password must be at least 8 characters',
        email: 'Invalid email format'
      }
    })
    
    render(<RegisterForm />)
    
    expect(screen.getByText('Username is required')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Invalid email format')).toBeInTheDocument()
  })

  it('applies error styling to fields with errors', () => {
    vi.mocked(useActionData).mockReturnValue({
      errors: {
        username: 'Username error',
        password: 'Password error',
        email: 'Email error'
      }
    })
    
    render(<RegisterForm />)
    
    expect(screen.getByLabelText('Username')).toHaveClass('border-red-500')
    expect(screen.getByLabelText('Password')).toHaveClass('border-red-500')
    expect(screen.getByLabelText('Email (optional)')).toHaveClass('border-red-500')
  })

  it('applies normal styling to fields without errors', () => {
    render(<RegisterForm />)
    
    expect(screen.getByLabelText('Username')).toHaveClass('border-gray-300')
    expect(screen.getByLabelText('Password')).toHaveClass('border-gray-300')
    expect(screen.getByLabelText('Email (optional)')).toHaveClass('border-gray-300')
  })
})