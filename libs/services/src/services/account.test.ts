import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AccountService } from './account.js'
import { NullEmailService } from './null-email.js'
import type {
  UserRepository,
  User,
  PasswordResetRepository,
  EmailService,
  PasswordResetToken,
} from '@pinsquirrel/domain'
import {
  InvalidResetTokenError,
  ResetTokenExpiredError,
  TooManyResetRequestsError,
  Role,
  UserStatus,
} from '@pinsquirrel/domain'

// Mock the crypto module (which contains crypto functions)
vi.mock('../utils/crypto.js', () => ({
  hashPassword: vi
    .fn()
    .mockImplementation((password: string) =>
      Promise.resolve(`hashed_${password}`)
    ),
  hashEmail: vi.fn().mockImplementation((email: string) => `hashed_${email}`),
  generateSecureToken: vi.fn().mockReturnValue('mock-token'),
  hashToken: vi.fn().mockImplementation((token: string) => `hashed_${token}`),
}))

describe('AccountService', () => {
  let accountService: AccountService
  let mockUserRepository: UserRepository
  let mockPasswordResetRepository: PasswordResetRepository
  let mockEmailService: EmailService

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    passwordHash: 'hashedpassword',
    emailHash: null,
    emailEncrypted: null,
    roles: [Role.User],
    status: UserStatus.Active,
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
      findByStatus: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addRole: vi.fn(),
    }

    mockPasswordResetRepository = {
      findById: vi.fn(),
      findByTokenHash: vi.fn(),
      findByUserId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByUserId: vi.fn(),
      deleteExpiredTokens: vi.fn(),
      isValidToken: vi.fn(),
    }

    mockEmailService = {
      sendPasswordResetEmail: vi.fn(),
      sendSignupNotificationEmail: vi.fn(),
      sendEmailAlreadyRegisteredEmail: vi.fn(),
      sendUsernameTakenEmail: vi.fn(),
    }

    accountService = new AccountService(
      mockUserRepository,
      mockPasswordResetRepository,
      mockEmailService
    )
  })

  describe('register', () => {
    it('should register a new user with email verification', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()

      const registerInput = {
        username: 'testuser',
        email: 'test@example.com',
      }

      await accountService.register(registerInput)

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser')
      expect(mockUserRepository.findByEmailHash).toHaveBeenCalledWith(
        'hashed_test@example.com'
      )
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: null,
        emailHash: 'hashed_test@example.com',
        emailEncrypted: null,
      })
      expect(mockUserRepository.addRole).toHaveBeenCalledWith(
        mockUser.id,
        'User'
      )
    })

    it('should seal the email when an email sealer is configured', async () => {
      const emailSealer = {
        seal: vi.fn().mockResolvedValue('sealed-email-blob'),
      }
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        mockEmailService,
        emailSealer
      )
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()

      await service.register({
        username: 'testuser',
        email: 'test@example.com',
      })

      expect(emailSealer.seal).toHaveBeenCalledWith('test@example.com')
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: null,
        emailHash: 'hashed_test@example.com',
        emailEncrypted: 'sealed-email-blob',
      })
    })

    it('should not throw when username is already taken', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockEmailService.sendUsernameTakenEmail).mockResolvedValue()

      const registerInput = {
        username: 'testuser',
        email: 'new@example.com',
        signupUrl: 'http://localhost/signup',
      }

      await accountService.register(registerInput)

      expect(mockEmailService.sendUsernameTakenEmail).toHaveBeenCalledWith(
        'new@example.com',
        'testuser',
        'http://localhost/signup'
      )
      expect(mockUserRepository.create).not.toHaveBeenCalled()
    })

    it('should not throw when email is already registered', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(mockUser)
      vi.mocked(
        mockEmailService.sendEmailAlreadyRegisteredEmail
      ).mockResolvedValue()

      const registerInput = {
        username: 'newuser',
        email: 'test@example.com',
        signinUrl: 'http://localhost/signin',
      }

      await accountService.register(registerInput)

      expect(
        mockEmailService.sendEmailAlreadyRegisteredEmail
      ).toHaveBeenCalledWith('test@example.com', 'http://localhost/signin')
      expect(mockUserRepository.create).not.toHaveBeenCalled()
    })

    it('should send already-registered email when both username and email exist', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(mockUser)
      vi.mocked(
        mockEmailService.sendEmailAlreadyRegisteredEmail
      ).mockResolvedValue()

      const registerInput = {
        username: 'testuser',
        email: 'test@example.com',
        signinUrl: 'http://localhost/signin',
      }

      await accountService.register(registerInput)

      expect(
        mockEmailService.sendEmailAlreadyRegisteredEmail
      ).toHaveBeenCalledWith('test@example.com', 'http://localhost/signin')
      expect(mockEmailService.sendUsernameTakenEmail).not.toHaveBeenCalled()
      expect(mockUserRepository.create).not.toHaveBeenCalled()
    })

    it('should not fail registration if conflict notification email throws', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockEmailService.sendUsernameTakenEmail).mockRejectedValue(
        new Error('Email service failed')
      )

      const registerInput = {
        username: 'testuser',
        email: 'new@example.com',
        signupUrl: 'http://localhost/signup',
      }

      // Should not throw even though email sending fails
      await accountService.register(registerInput)

      expect(mockUserRepository.create).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid username', async () => {
      const registerInput = {
        username: 'ab', // too short
        email: 'test@example.com',
      }

      await expect(accountService.register(registerInput)).rejects.toThrow(
        'Username must be at least 3 characters'
      )
    })

    it('should throw validation error for invalid email', async () => {
      const registerInput = {
        username: 'testuser',
        email: 'invalid-email',
      }

      await expect(accountService.register(registerInput)).rejects.toThrow(
        'Invalid email address'
      )
    })

    // Email is now required, so no tests for undefined/empty email

    it('should send signup notification email when notifyEmail is provided', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()
      vi.mocked(
        mockEmailService.sendSignupNotificationEmail
      ).mockResolvedValue()

      const registerInput = {
        username: 'testuser',
        email: 'test@example.com',
        notifyEmail: 'admin@example.com',
      }

      await accountService.register(registerInput)

      expect(mockEmailService.sendSignupNotificationEmail).toHaveBeenCalledWith(
        'admin@example.com',
        'testuser',
        'test@example.com'
      )
    })

    it('should not send signup notification when notifyEmail is not provided', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()

      const registerInput = {
        username: 'testuser',
        email: 'test@example.com',
      }

      await accountService.register(registerInput)

      expect(
        mockEmailService.sendSignupNotificationEmail
      ).not.toHaveBeenCalled()
    })

    it('should return emailFailed false on successful registration', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()

      const result = await accountService.register({
        username: 'testuser',
        email: 'test@example.com',
      })

      expect(result).toEqual({ emailFailed: false })
    })

    it('should return emailFailed true when verification email fails', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      // First call (register check) returns null, second call (requestPasswordReset) returns user
      vi.mocked(mockUserRepository.findByEmailHash)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      vi.mocked(mockPasswordResetRepository.create).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockEmailService.sendPasswordResetEmail).mockRejectedValue(
        new Error('Email service unavailable')
      )

      const result = await accountService.register({
        username: 'testuser',
        email: 'test@example.com',
        resetUrl: 'http://localhost/reset-password',
      })

      expect(result).toEqual({ emailFailed: true })
      expect(mockUserRepository.create).toHaveBeenCalled()
    })

    it('should not fail registration if signup notification email fails', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()
      vi.mocked(mockEmailService.sendSignupNotificationEmail).mockRejectedValue(
        new Error('Email service failed')
      )

      const registerInput = {
        username: 'testuser',
        email: 'test@example.com',
        notifyEmail: 'admin@example.com',
      }

      // Should not throw even though email sending fails
      await accountService.register(registerInput)

      expect(mockEmailService.sendSignupNotificationEmail).toHaveBeenCalled()
    })
  })

  describe('with no email provider configured', () => {
    it('reports emailFailed rather than claiming the email was sent', async () => {
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        new NullEmailService()
      )
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      // First call is register's duplicate check (no match); the second is the
      // lookup inside requestPasswordReset, by which point the user exists.
      vi.mocked(mockUserRepository.findByEmailHash)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])

      const result = await service.register({
        username: 'testuser',
        email: 'test@example.com',
        resetUrl: 'http://localhost/reset-password',
      })

      expect(result.emailFailed).toBe(true)
      // The account is still created; only delivery failed.
      expect(mockUserRepository.create).toHaveBeenCalled()
    })

    it('still creates the account when the signup notification cannot send', async () => {
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        new NullEmailService()
      )
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()

      await expect(
        service.register({
          username: 'testuser',
          email: 'test@example.com',
          notifyEmail: 'ops@example.com',
        })
      ).resolves.toBeDefined()
    })
  })

  describe('updateEmail', () => {
    it('should update email', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)

      await accountService.updateEmail({
        userId: '123',
        email: 'newemail@example.com',
      })

      expect(mockUserRepository.findById).toHaveBeenCalledWith('123')
      // Only the fields this operation owns — never username/passwordHash, which
      // could clobber a concurrent change made after the findById read.
      expect(mockUserRepository.update).toHaveBeenCalledWith('123', {
        emailHash: 'hashed_newemail@example.com',
        emailEncrypted: null,
      })
    })

    it('should clear email when null is provided', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)

      await accountService.updateEmail({
        userId: '123',
        email: null,
      })

      expect(mockUserRepository.findById).toHaveBeenCalledWith('123')
      expect(mockUserRepository.update).toHaveBeenCalledWith('123', {
        emailHash: null,
        emailEncrypted: null,
      })
    })

    it('should re-seal the email when a sealer is configured', async () => {
      const emailSealer = {
        seal: vi.fn().mockResolvedValue('resealed-blob'),
      }
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        mockEmailService,
        emailSealer
      )
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)

      await service.updateEmail({
        userId: '123',
        email: 'newemail@example.com',
      })

      expect(emailSealer.seal).toHaveBeenCalledWith('newemail@example.com')
      expect(mockUserRepository.update).toHaveBeenCalledWith('123', {
        emailHash: 'hashed_newemail@example.com',
        emailEncrypted: 'resealed-blob',
      })
    })

    it('should throw validation error for invalid email', async () => {
      await expect(
        accountService.updateEmail({
          userId: '123',
          email: 'invalid-email',
        })
      ).rejects.toThrow('Invalid email address')
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

      const result = await accountService.requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })

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

    it('should backfill the sealed email when missing and a sealer is configured', async () => {
      const emailSealer = { seal: vi.fn().mockResolvedValue('backfilled-blob') }
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        mockEmailService,
        emailSealer
      )
      const userMissingSeal = {
        ...mockUser,
        emailHash: 'hashed_test@example.com',
        emailEncrypted: null,
      }
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(
        userMissingSeal
      )
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      vi.mocked(mockPasswordResetRepository.create).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockEmailService.sendPasswordResetEmail).mockResolvedValue()

      await service.requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })

      expect(emailSealer.seal).toHaveBeenCalledWith('test@example.com')
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userMissingSeal.id,
        { emailEncrypted: 'backfilled-blob' }
      )
    })

    it('should not re-seal when the user already has a sealed email', async () => {
      const emailSealer = { seal: vi.fn().mockResolvedValue('new-blob') }
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        mockEmailService,
        emailSealer
      )
      const userWithSeal = {
        ...mockUser,
        emailHash: 'hashed_test@example.com',
        emailEncrypted: 'existing-blob',
      }
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(
        userWithSeal
      )
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      vi.mocked(mockPasswordResetRepository.create).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockEmailService.sendPasswordResetEmail).mockResolvedValue()

      await service.requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })

      expect(emailSealer.seal).not.toHaveBeenCalled()
      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('still completes the reset when the opportunistic backfill fails', async () => {
      const emailSealer = { seal: vi.fn().mockResolvedValue('sealed-blob') }
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        mockEmailService,
        emailSealer
      )
      const userMissingSeal = {
        ...mockUser,
        emailHash: 'hashed_test@example.com',
        emailEncrypted: null,
      }
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(
        userMissingSeal
      )
      // The backfill write fails — it must not abort the password reset.
      vi.mocked(mockUserRepository.update).mockRejectedValue(
        new Error('db write failed')
      )
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      vi.mocked(mockPasswordResetRepository.create).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockEmailService.sendPasswordResetEmail).mockResolvedValue()

      const result = await service.requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })

      expect(mockUserRepository.update).toHaveBeenCalled()
      expect(mockPasswordResetRepository.create).toHaveBeenCalled()
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled()
      expect(result).toBe('mock-token')
    })

    it('should not reveal if email does not exist', async () => {
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)

      const result = await accountService.requestPasswordReset({
        email: 'nonexistent@example.com',
        resetUrl: 'https://example.com/reset',
      })

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
        accountService.requestPasswordReset({
          email: 'test@example.com',
          resetUrl: 'https://example.com/reset',
        })
      ).rejects.toThrow(TooManyResetRequestsError)

      expect(mockPasswordResetRepository.create).not.toHaveBeenCalled()
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid email', async () => {
      await expect(
        accountService.requestPasswordReset({
          email: 'invalid-email',
          resetUrl: 'https://example.com/reset',
        })
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

      await accountService.resetPassword({
        token: 'mock-token',
        newPassword: 'newpassword123',
      })

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

    it('should promote an unverified user to the waitlist when they set their password', async () => {
      const unverifiedUser = { ...mockUser, status: UserStatus.Unverified }
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockPasswordResetRepository.isValidToken).mockResolvedValue(
        true
      )
      vi.mocked(mockUserRepository.findById).mockResolvedValue(unverifiedUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(unverifiedUser)
      vi.mocked(mockPasswordResetRepository.delete).mockResolvedValue(true)

      await accountService.resetPassword({
        token: 'mock-token',
        newPassword: 'newpassword123',
      })

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        unverifiedUser.id,
        {
          passwordHash: 'hashed_newpassword123',
          status: UserStatus.Waitlist,
        }
      )
    })

    it('should throw error for invalid token', async () => {
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        null
      )

      await expect(
        accountService.resetPassword({
          token: 'invalid-token',
          newPassword: 'newpassword123',
        })
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
        accountService.resetPassword({
          token: 'mock-token',
          newPassword: 'newpassword123',
        })
      ).rejects.toThrow(ResetTokenExpiredError)

      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid password', async () => {
      await expect(
        accountService.resetPassword({
          token: 'mock-token',
          newPassword: 'short',
        })
      ).rejects.toThrow('Password must be at least 12 characters')
    })

    it('should handle user deleted after token creation', async () => {
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockPasswordResetRepository.isValidToken).mockResolvedValue(
        true
      )
      // User no longer exists
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

      await expect(
        accountService.resetPassword({
          token: 'mock-token',
          newPassword: 'newpassword123',
        })
      ).rejects.toThrow(InvalidResetTokenError)

      expect(mockUserRepository.update).not.toHaveBeenCalled()
      expect(mockPasswordResetRepository.delete).not.toHaveBeenCalled()
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

      const result = await accountService.validateResetToken('mock-token')

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

      const result = await accountService.validateResetToken('invalid-token')

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

      const result = await accountService.validateResetToken('mock-token')

      expect(result).toBe(false)
    })
  })
})
