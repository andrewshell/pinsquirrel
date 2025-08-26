import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthenticationService } from './authentication-service.js'
import type {
  UserRepository,
  User,
  PasswordResetRepository,
  EmailService,
  PasswordResetToken,
} from '@pinsquirrel/domain'
import {
  InvalidCredentialsError,
  UserAlreadyExistsError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
  TooManyResetRequestsError,
} from '@pinsquirrel/domain'

// Mock the crypto module (which contains crypto functions)
vi.mock('../utils/crypto.js', () => ({
  hashPassword: vi
    .fn()
    .mockImplementation((password: string) =>
      Promise.resolve(`hashed_${password}`)
    ),
  verifyPassword: vi.fn(),
  hashEmail: vi.fn().mockImplementation((email: string) => `hashed_${email}`),
  generateSecureToken: vi.fn().mockReturnValue('mock-token'),
  hashToken: vi.fn().mockImplementation((token: string) => `hashed_${token}`),
}))

import { verifyPassword } from '../utils/crypto.js'

describe('AuthenticationService', () => {
  let authService: AuthenticationService
  let mockUserRepository: UserRepository
  let mockPasswordResetRepository: PasswordResetRepository
  let mockEmailService: EmailService

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    passwordHash: 'hashedpassword',
    emailHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockPasswordResetToken: PasswordResetToken = {
    id: 'reset-123',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    tokenHash: 'hashed_token',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
    createdAt: new Date(),
  }

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
      findByEmailHash: vi.fn(),
      findByUsername: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }

    mockPasswordResetRepository = {
      findById: vi.fn(),
      findByTokenHash: vi.fn(),
      findByUserId: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByUserId: vi.fn(),
      deleteExpiredTokens: vi.fn(),
      isValidToken: vi.fn(),
    }

    mockEmailService = {
      sendPasswordResetEmail: vi.fn(),
    }

    authService = new AuthenticationService(
      mockUserRepository,
      mockPasswordResetRepository,
      mockEmailService
    )
  })

  describe('register', () => {
    it('should register a new user without email', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)

      const result = await authService.register('testuser', 'password123')

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser')
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: 'hashed_password123',
        emailHash: null,
      })
      expect(result).toEqual(mockUser)
    })

    it('should register a new user with email', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)

      const result = await authService.register(
        'testuser',
        'password123',
        'test@example.com'
      )

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: 'hashed_password123',
        emailHash: 'hashed_test@example.com',
      })
      expect(result).toEqual(mockUser)
    })

    it('should throw UserAlreadyExistsError if username is taken', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser)

      await expect(
        authService.register('testuser', 'password123')
      ).rejects.toThrow(UserAlreadyExistsError)

      expect(mockUserRepository.create).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid username', async () => {
      await expect(
        authService.register('ab', 'password123') // too short
      ).rejects.toThrow('Username must be at least 3 characters')
    })

    it('should throw validation error for invalid password', async () => {
      await expect(
        authService.register('testuser', 'short') // too short
      ).rejects.toThrow('Password must be at least 8 characters')
    })

    it('should throw validation error for invalid email', async () => {
      await expect(
        authService.register('testuser', 'password123', 'invalid-email')
      ).rejects.toThrow('Invalid email address')
    })

    it('should register user with undefined email', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)

      const result = await authService.register(
        'testuser',
        'password123',
        undefined
      )

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: 'hashed_password123',
        emailHash: null,
      })
      expect(result).toEqual(mockUser)
    })

    it('should throw validation error for empty string email', async () => {
      await expect(
        authService.register('testuser', 'password123', '') // empty string is invalid
      ).rejects.toThrow('Invalid email address')
    })
  })

  describe('login', () => {
    it('should authenticate valid credentials', async () => {
      const userWithPassword = {
        ...mockUser,
        passwordHash: '$2b$10$validhash', // Mock hash
      }
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(
        userWithPassword
      )
      vi.mocked(verifyPassword).mockResolvedValue(true)

      const result = await authService.login('testuser', 'password123')

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser')
      expect(verifyPassword).toHaveBeenCalledWith(
        'password123',
        '$2b$10$validhash'
      )
      expect(result).toEqual(userWithPassword)
    })

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)

      await expect(
        authService.login('nonexistent', 'password123')
      ).rejects.toThrow(InvalidCredentialsError)
    })

    it('should throw InvalidCredentialsError for wrong password', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser)
      vi.mocked(verifyPassword).mockResolvedValue(false)

      await expect(
        authService.login('testuser', 'wrongpassword')
      ).rejects.toThrow(InvalidCredentialsError)
    })

    it('should throw validation error for invalid username', async () => {
      await expect(
        authService.login('ab', 'password123') // too short
      ).rejects.toThrow('Username must be at least 3 characters')
    })

    it('should throw validation error for invalid password', async () => {
      await expect(
        authService.login('testuser', 'short') // too short
      ).rejects.toThrow('Password must be at least 8 characters')
    })
  })

  describe('changePassword', () => {
    it('should update password with valid current password', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)
      vi.mocked(verifyPassword).mockResolvedValue(true)

      await authService.changePassword('123', 'currentpass123', 'newpass123')

      expect(mockUserRepository.findById).toHaveBeenCalledWith('123')
      expect(verifyPassword).toHaveBeenCalledWith(
        'currentpass123',
        mockUser.passwordHash
      )
      expect(mockUserRepository.update).toHaveBeenCalledWith('123', {
        passwordHash: 'hashed_newpass123',
      })
    })

    it('should throw InvalidCredentialsError for wrong current password', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(verifyPassword).mockResolvedValue(false)

      await expect(
        authService.changePassword('123', 'wrongpass123', 'newpass123')
      ).rejects.toThrow(InvalidCredentialsError)

      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

      await expect(
        authService.changePassword('999', 'currentpass123', 'newpass123')
      ).rejects.toThrow(InvalidCredentialsError)
    })

    it('should throw validation error for invalid current password', async () => {
      await expect(
        authService.changePassword('123', 'short', 'newpass123') // current password too short
      ).rejects.toThrow('Password must be at least 8 characters')
    })

    it('should throw validation error for invalid new password', async () => {
      await expect(
        authService.changePassword('123', 'currentpass123', 'short') // new password too short
      ).rejects.toThrow('Password must be at least 8 characters')
    })
  })

  describe('updateEmail', () => {
    it('should update email', async () => {
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)

      await authService.updateEmail('123', 'newemail@example.com')

      expect(mockUserRepository.update).toHaveBeenCalledWith('123', {
        emailHash: 'hashed_newemail@example.com',
      })
    })

    it('should clear email when null is provided', async () => {
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)

      await authService.updateEmail('123', null)

      expect(mockUserRepository.update).toHaveBeenCalledWith('123', {
        emailHash: null,
      })
    })

    it('should throw validation error for invalid email', async () => {
      await expect(
        authService.updateEmail('123', 'invalid-email')
      ).rejects.toThrow('Invalid email address')
    })
  })

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(mockUser)

      const result = await authService.findByEmail('test@example.com')

      expect(mockUserRepository.findByEmailHash).toHaveBeenCalledWith(
        'hashed_test@example.com'
      )
      expect(result).toEqual(mockUser)
    })

    it('should return null when user not found', async () => {
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)

      const result = await authService.findByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })

    it('should throw validation error for invalid email', async () => {
      await expect(authService.findByEmail('invalid-email')).rejects.toThrow(
        'Invalid email'
      )
    })
  })

  describe('requestPasswordReset', () => {
    it('should create a password reset token and send email', async () => {
      const mockUserWithEmail = {
        ...mockUser,
        emailHash: 'hashed_test@example.com',
      }
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(
        mockUserWithEmail
      )
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      vi.mocked(mockPasswordResetRepository.create).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockEmailService.sendPasswordResetEmail).mockResolvedValue()

      const result = await authService.requestPasswordReset(
        'test@example.com',
        'https://example.com/reset'
      )

      expect(mockUserRepository.findByEmailHash).toHaveBeenCalledWith(
        'hashed_test@example.com'
      )
      expect(mockPasswordResetRepository.deleteByUserId).toHaveBeenCalledWith(
        mockUserWithEmail.id
      )
      expect(mockPasswordResetRepository.create).toHaveBeenCalledWith({
        userId: mockUserWithEmail.id,
        tokenHash: 'hashed_mock-token',
        expiresAt: expect.any(Date),
      })
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        'mock-token',
        'https://example.com/reset'
      )
      expect(result).toBe('mock-token')
    })

    it('should not reveal if email does not exist', async () => {
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)

      const result = await authService.requestPasswordReset(
        'nonexistent@example.com',
        'https://example.com/reset'
      )

      expect(mockUserRepository.findByEmailHash).toHaveBeenCalledWith(
        'hashed_nonexistent@example.com'
      )
      expect(mockPasswordResetRepository.create).not.toHaveBeenCalled()
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should enforce rate limiting', async () => {
      const mockUserWithEmail = {
        ...mockUser,
        emailHash: 'hashed_test@example.com',
      }
      const recentTokens = [
        {
          ...mockPasswordResetToken,
          createdAt: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          ...mockPasswordResetToken,
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
        },
        {
          ...mockPasswordResetToken,
          createdAt: new Date(Date.now() - 20 * 60 * 1000),
        },
      ]
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(
        mockUserWithEmail
      )
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue(
        recentTokens
      )

      await expect(
        authService.requestPasswordReset(
          'test@example.com',
          'https://example.com/reset'
        )
      ).rejects.toThrow(TooManyResetRequestsError)

      expect(mockPasswordResetRepository.create).not.toHaveBeenCalled()
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid email', async () => {
      await expect(
        authService.requestPasswordReset(
          'invalid-email',
          'https://example.com/reset'
        )
      ).rejects.toThrow('Invalid email address')
    })
  })

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockPasswordResetRepository.isValidToken).mockResolvedValue(
        true
      )
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)
      vi.mocked(mockPasswordResetRepository.delete).mockResolvedValue(true)

      await authService.resetPassword('mock-token', 'newpassword123')

      expect(mockPasswordResetRepository.findByTokenHash).toHaveBeenCalledWith(
        'hashed_mock-token'
      )
      expect(mockPasswordResetRepository.isValidToken).toHaveBeenCalledWith(
        'hashed_mock-token'
      )
      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        passwordHash: 'hashed_newpassword123',
      })
      expect(mockPasswordResetRepository.delete).toHaveBeenCalledWith(
        mockPasswordResetToken.id
      )
    })

    it('should throw error for invalid token', async () => {
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        null
      )

      await expect(
        authService.resetPassword('invalid-token', 'newpassword123')
      ).rejects.toThrow(InvalidResetTokenError)

      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('should throw error for expired token', async () => {
      const expiredToken = {
        ...mockPasswordResetToken,
        expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
      }
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        expiredToken
      )
      vi.mocked(mockPasswordResetRepository.isValidToken).mockResolvedValue(
        false
      )

      await expect(
        authService.resetPassword('mock-token', 'newpassword123')
      ).rejects.toThrow(ResetTokenExpiredError)

      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid password', async () => {
      await expect(
        authService.resetPassword('mock-token', 'short')
      ).rejects.toThrow('Password must be at least 8 characters')
    })
  })

  describe('validateResetToken', () => {
    it('should return true for valid token', async () => {
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockPasswordResetRepository.isValidToken).mockResolvedValue(
        true
      )

      const result = await authService.validateResetToken('mock-token')

      expect(mockPasswordResetRepository.findByTokenHash).toHaveBeenCalledWith(
        'hashed_mock-token'
      )
      expect(mockPasswordResetRepository.isValidToken).toHaveBeenCalledWith(
        'hashed_mock-token'
      )
      expect(result).toBe(true)
    })

    it('should return false for invalid token', async () => {
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        null
      )

      const result = await authService.validateResetToken('invalid-token')

      expect(result).toBe(false)
    })

    it('should return false for expired token', async () => {
      const expiredToken = {
        ...mockPasswordResetToken,
        expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
      }
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        expiredToken
      )
      vi.mocked(mockPasswordResetRepository.isValidToken).mockResolvedValue(
        false
      )

      const result = await authService.validateResetToken('mock-token')

      expect(result).toBe(false)
    })
  })
})
