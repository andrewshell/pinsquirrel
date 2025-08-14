import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { UpdateEmailForm } from './UpdateEmailForm'
import { ChangePasswordForm } from './ChangePasswordForm'

// Mock useFetcher for test data control
let fetcherData: any = { data: undefined, state: 'idle', Form: 'form' }

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useFetcher: vi.fn().mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return fetcherData
    }),
  }
})

describe('Profile Forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetcherData = {
      data: undefined,
      state: 'idle',
      Form: 'form',
    }
  })

  const renderWithRouter = (component: React.ReactElement) => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: () => component,
      },
    ])

    return render(<Stub initialEntries={['/']} />)
  }

  describe('UpdateEmailForm', () => {
    it('renders email form with correct structure', () => {
      renderWithRouter(<UpdateEmailForm />)

      expect(screen.getAllByText('Update Email')).toHaveLength(2) // Card title + button
      expect(screen.getByLabelText('New Email Address')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Update Email' })
      ).toBeInTheDocument()
      expect(screen.getByDisplayValue('update-email')).toBeInTheDocument()
    })

    it('shows loading state when submitting', () => {
      fetcherData = {
        data: undefined,
        state: 'submitting',
        Form: 'form',
      }

      renderWithRouter(<UpdateEmailForm />)

      const submitButton = screen.getByRole('button', { name: 'Updating...' })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('displays validation errors', () => {
      fetcherData = {
        data: { errors: { email: 'Invalid email format' } },
        state: 'idle',
        Form: 'form',
      }

      renderWithRouter(<UpdateEmailForm />)

      expect(screen.getByText('Invalid email format')).toBeInTheDocument()
      expect(screen.getByLabelText('New Email Address')).toHaveClass(
        'border-red-500'
      )
    })

    it('displays success message', () => {
      fetcherData = {
        data: {
          success: 'Email updated successfully',
          field: 'email',
        },
        state: 'idle',
        Form: 'form',
      }

      renderWithRouter(<UpdateEmailForm />)

      expect(screen.getByText('Email updated successfully')).toBeInTheDocument()
    })

    it('displays form-level errors', () => {
      fetcherData = {
        data: { errors: { _form: 'Email update failed' } },
        state: 'idle',
        Form: 'form',
      }

      renderWithRouter(<UpdateEmailForm />)

      expect(screen.getByText('Email update failed')).toBeInTheDocument()
    })
  })

  describe('ChangePasswordForm', () => {
    it('renders password form with correct structure', () => {
      renderWithRouter(<ChangePasswordForm username="testuser" />)

      expect(screen.getAllByText('Change Password')).toHaveLength(2) // Card title + button
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
      expect(screen.getByLabelText('New Password')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Change Password' })
      ).toBeInTheDocument()
      expect(screen.getByDisplayValue('change-password')).toBeInTheDocument()
      expect(
        screen.getByText('Must be at least 8 characters')
      ).toBeInTheDocument()
    })

    it('includes hidden username field for accessibility', () => {
      renderWithRouter(<ChangePasswordForm username="testuser" />)

      const hiddenUsernameField = screen.getByDisplayValue('testuser')
      expect(hiddenUsernameField).toBeInTheDocument()
      expect(hiddenUsernameField).toHaveAttribute('type', 'text')
      expect(hiddenUsernameField).toHaveAttribute('hidden')
      expect(hiddenUsernameField).toHaveAttribute('autocomplete', 'username')
    })

    it('shows loading state when submitting', () => {
      fetcherData = {
        data: undefined,
        state: 'submitting',
        Form: 'form',
      }

      renderWithRouter(<ChangePasswordForm username="testuser" />)

      const submitButton = screen.getByRole('button', { name: 'Changing...' })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('displays validation errors with FormText component', () => {
      fetcherData = {
        data: {
          errors: {
            currentPassword: 'Current password is required',
            newPassword: 'Password must be at least 8 characters',
          },
        },
        state: 'idle',
        Form: 'form',
      }

      renderWithRouter(<ChangePasswordForm username="testuser" />)

      expect(
        screen.getByText('Current password is required')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Password must be at least 8 characters')
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Current Password')).toHaveClass(
        'border-red-500'
      )
      expect(screen.getByLabelText('New Password')).toHaveClass(
        'border-red-500'
      )
    })

    it('shows hint text when no errors', () => {
      renderWithRouter(<ChangePasswordForm username="testuser" />)

      expect(
        screen.getByText('Must be at least 8 characters')
      ).toBeInTheDocument()
    })

    it('displays success message', () => {
      fetcherData = {
        data: {
          success: 'Password changed successfully',
          field: 'password',
        },
        state: 'idle',
        Form: 'form',
      }

      renderWithRouter(<ChangePasswordForm username="testuser" />)

      expect(
        screen.getByText('Password changed successfully')
      ).toBeInTheDocument()
    })

    it('displays form-level errors', () => {
      fetcherData = {
        data: { errors: { _form: 'Invalid credentials' } },
        state: 'idle',
        Form: 'form',
      }

      renderWithRouter(<ChangePasswordForm username="testuser" />)

      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })
})
