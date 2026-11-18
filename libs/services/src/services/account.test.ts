import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createDeferQueue, createMockUserRepository } from '../test-utils.js'
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
  Role,
  UserAlreadyExistsError,
  UnauthorizedUserAccessError,
  AccessControl,
  UserStatus,
} from '@pinsquirrel/domain'

// Mock the crypto module (which contains crypto functions)
vi.mock('../utils/crypto.js', () => ({
  hashPassword: vi
    .fn()
    .mockImplementation((password: string) =>
      Promise.resolve(`hashed_${password}`)
    ),
  hashEmail: vi
    .fn()
    .mockImplementation((email: string, key?: string) =>
      key ? `keyed_${email}` : `hashed_${email}`
    ),
  generateSecureToken: vi.fn().mockReturnValue('mock-token'),
  hashToken: vi.fn().mockImplementation((token: string) => `hashed_${token}`),
}))

/** A reset-token store that keeps its rows, so per-account counts are real. */
function inMemoryResets(): PasswordResetRepository {
  const rows: PasswordResetToken[] = []
  return {
    findById: vi.fn(),
    findByTokenHash: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteExpiredTokens: vi.fn(),
    isValidToken: vi.fn(),
    consume: vi.fn(),
    findByUserId: vi.fn((userId: string) =>
      Promise.resolve(rows.filter(r => r.userId === userId))
    ),
    create: vi.fn((data: Omit<PasswordResetToken, 'id' | 'createdAt'>) => {
      const row = { id: `reset-${rows.length}`, createdAt: new Date(), ...data }
      rows.push(row)
      return Promise.resolve(row)
    }),
    deleteByUserId: vi.fn((userId: string) => {
      const before = rows.length
      rows.splice(0, rows.length, ...rows.filter(r => r.userId !== userId))
      return Promise.resolve(rows.length < before)
    }),
  }
}

describe('AccountService', () => {
  let accountService: AccountService
  let mockUserRepository: UserRepository
  let mockPasswordResetRepository: PasswordResetRepository
  let mockEmailService: EmailService
  let queue: ReturnType<typeof createDeferQueue>

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

  /** The AccessControl a signed-in user has over their own account. */
  const selfAc = (id: string) => new AccessControl({ ...mockUser, id })

  const mockPasswordResetToken: PasswordResetToken = {
    id: 'reset-123',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    tokenHash: 'hashed_token',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
    createdAt: new Date(),
  }

  beforeEach(() => {
    mockUserRepository = createMockUserRepository()

    mockPasswordResetRepository = {
      findById: vi.fn(),
      findByTokenHash: vi.fn(),
      findByUserId: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByUserId: vi.fn(),
      deleteExpiredTokens: vi.fn(),
      isValidToken: vi.fn(),
      consume: vi.fn().mockResolvedValue(true),
    }

    mockEmailService = {
      sendPasswordResetEmail: vi.fn(),
      sendSignupNotificationEmail: vi.fn(),
      sendEmailAlreadyRegisteredEmail: vi.fn(),
      sendUsernameTakenEmail: vi.fn(),
    }

    queue = createDeferQueue()
    accountService = new AccountService(
      mockUserRepository,
      mockPasswordResetRepository,
      mockEmailService,
      { defer: queue.defer }
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

      accountService.register(registerInput)
      await queue.flush()

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser')
      expect(mockUserRepository.findByEmailHash).toHaveBeenCalledWith(
        'hashed_test@example.com'
      )
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: null,
        emailHash: 'hashed_test@example.com',
        emailEncrypted: null,
        roles: [Role.User],
      })
      expect(mockUserRepository.addRole).not.toHaveBeenCalled()
    })

    it('should seal the email when an email sealer is configured', async () => {
      const emailSealer = {
        seal: vi.fn().mockResolvedValue('sealed-email-blob'),
      }
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        mockEmailService,
        { defer: queue.defer, emailSealer }
      )
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()

      service.register({
        username: 'testuser',
        email: 'test@example.com',
      })
      await queue.flush()

      expect(emailSealer.seal).toHaveBeenCalledWith('test@example.com')
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: null,
        emailHash: 'hashed_test@example.com',
        emailEncrypted: 'sealed-email-blob',
        roles: [Role.User],
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

      accountService.register(registerInput)
      await queue.flush()

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
        resetUrl: 'http://localhost/reset-password',
      }

      accountService.register(registerInput)
      await queue.flush()

      expect(
        mockEmailService.sendEmailAlreadyRegisteredEmail
      ).toHaveBeenCalledWith(
        'test@example.com',
        'http://localhost/signin',
        'mock-token',
        'http://localhost/reset-password'
      )
      expect(mockUserRepository.create).not.toHaveBeenCalled()
    })

    // Two signups for the same email can pass the check above at the same
    // moment; the unique index on email_hash is what stops the second from
    // landing. The loser must come out of this the same way as a signup that
    // lost by a millisecond - quietly, revealing nothing about the account.
    it('answers the same way when the duplicate check loses a race', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockRejectedValue(
        new UserAlreadyExistsError('newuser')
      )

      accountService.register({
        username: 'newuser',
        email: 'test@example.com',
        signinUrl: 'http://localhost/signin',
      })
      await queue.flush()

      expect(mockUserRepository.addRole).not.toHaveBeenCalled()
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
        resetUrl: 'http://localhost/reset-password',
      }

      accountService.register(registerInput)
      await queue.flush()

      expect(
        mockEmailService.sendEmailAlreadyRegisteredEmail
      ).toHaveBeenCalledWith(
        'test@example.com',
        'http://localhost/signin',
        'mock-token',
        'http://localhost/reset-password'
      )
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

      accountService.register(registerInput)

      await expect(queue.flush()).rejects.toThrow('Email service failed')
      expect(mockUserRepository.create).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid username', () => {
      const registerInput = {
        username: 'ab', // too short
        email: 'test@example.com',
      }

      expect(() => accountService.register(registerInput)).toThrow(
        'Username must be at least 3 characters'
      )
    })

    it('should throw validation error for invalid email', () => {
      const registerInput = {
        username: 'testuser',
        email: 'invalid-email',
      }

      expect(() => accountService.register(registerInput)).toThrow(
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

      accountService.register(registerInput)
      await queue.flush()

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

      accountService.register(registerInput)
      await queue.flush()

      expect(
        mockEmailService.sendSignupNotificationEmail
      ).not.toHaveBeenCalled()
    })

    it('answers a new account the same way when the verification mail fails', async () => {
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

      accountService.register({
        username: 'testuser',
        email: 'test@example.com',
        resetUrl: 'http://localhost/reset-password',
      })

      await expect(queue.flush()).rejects.toThrow('Email service unavailable')
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

      accountService.register(registerInput)

      await expect(queue.flush()).rejects.toThrow('Email service failed')
      expect(mockEmailService.sendSignupNotificationEmail).toHaveBeenCalled()
    })
  })

  describe('with no email provider configured', () => {
    const taken = { ...mockUser, emailHash: 'hashed_someone@example.test' }
    const signup = {
      username: 'newperson',
      email: 'someone@example.test',
      resetUrl: 'https://x.test/reset-password',
      signinUrl: 'https://x.test/signin',
      signupUrl: 'https://x.test/signup',
    }

    it('answers a new account and a taken email identically', async () => {
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        new NullEmailService(),
        { defer: queue.defer }
      )
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)

      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(taken)
      expect(() => service.register(signup)).not.toThrow()
      await expect(queue.flush()).rejects.toThrow(
        'Email delivery is not configured'
      )

      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      expect(() => service.register(signup)).not.toThrow()
      await expect(queue.flush()).rejects.toThrow(
        'Email delivery is not configured'
      )
      expect(mockUserRepository.create).toHaveBeenCalledTimes(1)
    })

    it('answers forgot-password for a registered and an unknown address alike', async () => {
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        new NullEmailService(),
        { defer: queue.defer }
      )
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      const input = {
        email: 'someone@example.test',
        resetUrl: 'https://x.test',
      }

      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      expect(() => service.requestPasswordReset(input)).not.toThrow()
      await expect(queue.flush()).resolves.toBeUndefined()

      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(taken)
      expect(() => service.requestPasswordReset(input)).not.toThrow()
      await expect(queue.flush()).rejects.toThrow(
        'Email delivery is not configured'
      )
    })

    it('does not hold forgot-password open on the mail send', async () => {
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(taken)
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      vi.mocked(mockEmailService.sendPasswordResetEmail).mockReturnValue(
        new Promise<void>(() => {})
      )

      accountService.requestPasswordReset({
        email: 'someone@example.test',
        resetUrl: 'https://x.test',
      })

      await vi.waitFor(() =>
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled()
      )
    })

    it('still creates the account when the signup notification cannot send', async () => {
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        new NullEmailService(),
        { defer: queue.defer }
      )
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.addRole).mockResolvedValue()

      service.register({
        username: 'testuser',
        email: 'test@example.com',
        notifyEmail: 'ops@example.com',
      })
      await expect(queue.flush()).rejects.toThrow()
      expect(mockUserRepository.create).toHaveBeenCalled()
    })
  })

  describe('updateEmail', () => {
    it('should update email', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)

      await accountService.updateEmail(selfAc('123'), {
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

      await accountService.updateEmail(selfAc('123'), {
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
        { defer: queue.defer, emailSealer }
      )
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)

      await service.updateEmail(selfAc('123'), {
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
        accountService.updateEmail(selfAc('123'), {
          userId: '123',
          email: 'invalid-email',
        })
      ).rejects.toThrow('Invalid email address')
    })

    it("should refuse to change another user's email", async () => {
      const userA = new AccessControl({ ...mockUser, id: 'user-a' })

      await expect(
        accountService.updateEmail(userA, {
          userId: 'user-b',
          email: 'attacker@example.com',
        })
      ).rejects.toThrow(UnauthorizedUserAccessError)
      expect(mockUserRepository.findById).not.toHaveBeenCalled()
      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('should refuse an anonymous caller', async () => {
      await expect(
        accountService.updateEmail(new AccessControl(null), {
          userId: 'user-a',
          email: 'attacker@example.com',
        })
      ).rejects.toThrow(UnauthorizedUserAccessError)
      expect(mockUserRepository.findById).not.toHaveBeenCalled()
    })
  })

  describe('with an email hash key', () => {
    const keyed = () =>
      new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        mockEmailService,
        { defer: queue.defer, emailHashKey: 'server-secret' }
      )

    it('stores the keyed hash for a new account', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser)

      keyed().register({
        username: 'testuser',
        email: 'test@example.com',
      })
      await queue.flush()

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ emailHash: 'keyed_test@example.com' })
      )
    })

    it('finds an account stored under the unkeyed hash and rewrites it keyed', async () => {
      const legacy = { ...mockUser, emailHash: 'hashed_test@example.com' }
      vi.mocked(mockUserRepository.findByEmailHash).mockImplementation(hash =>
        Promise.resolve(hash === 'hashed_test@example.com' ? legacy : null)
      )
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      vi.mocked(mockPasswordResetRepository.create).mockResolvedValue(
        mockPasswordResetToken
      )

      keyed().requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })
      await queue.flush()

      expect(mockUserRepository.update).toHaveBeenCalledWith(legacy.id, {
        emailHash: 'keyed_test@example.com',
      })
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled()
    })

    it('does not rewrite an account already stored keyed', async () => {
      vi.mocked(mockUserRepository.findByEmailHash).mockImplementation(hash =>
        Promise.resolve(
          hash === 'keyed_test@example.com'
            ? { ...mockUser, emailHash: hash }
            : null
        )
      )
      vi.mocked(mockPasswordResetRepository.findByUserId).mockResolvedValue([])
      vi.mocked(mockPasswordResetRepository.create).mockResolvedValue(
        mockPasswordResetToken
      )

      keyed().requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })
      await queue.flush()

      expect(mockUserRepository.findByEmailHash).toHaveBeenCalledTimes(1)
      expect(mockUserRepository.update).not.toHaveBeenCalled()
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

      accountService.requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })
      await queue.flush()

      expect(mockUserRepository.findByEmailHash).toHaveBeenCalledWith(
        'hashed_test@example.com'
      )
      expect(mockPasswordResetRepository.deleteByUserId).not.toHaveBeenCalled()
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
    })

    it('should backfill the sealed email when missing and a sealer is configured', async () => {
      const emailSealer = { seal: vi.fn().mockResolvedValue('backfilled-blob') }
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        mockEmailService,
        { defer: queue.defer, emailSealer }
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

      service.requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })
      await queue.flush()

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
        { defer: queue.defer, emailSealer }
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

      service.requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })
      await queue.flush()

      expect(emailSealer.seal).not.toHaveBeenCalled()
      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('still completes the reset when the opportunistic backfill fails', async () => {
      const emailSealer = { seal: vi.fn().mockResolvedValue('sealed-blob') }
      const service = new AccountService(
        mockUserRepository,
        mockPasswordResetRepository,
        mockEmailService,
        { defer: queue.defer, emailSealer }
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

      service.requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })
      await queue.flush()

      expect(mockUserRepository.update).toHaveBeenCalled()
      expect(mockPasswordResetRepository.create).toHaveBeenCalled()
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled()
    })

    it('should not reveal if email does not exist', async () => {
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(null)

      accountService.requestPasswordReset({
        email: 'nonexistent@example.com',
        resetUrl: 'https://example.com/reset',
      })
      await queue.flush()

      expect(mockUserRepository.findByEmailHash).toHaveBeenCalledWith(
        'hashed_nonexistent@example.com'
      )
      expect(mockPasswordResetRepository.create).not.toHaveBeenCalled()
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('answers a request over the limit like an unknown address, sending nothing', async () => {
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

      accountService.requestPasswordReset({
        email: 'test@example.com',
        resetUrl: 'https://example.com/reset',
      })
      await queue.flush()

      expect(mockPasswordResetRepository.create).not.toHaveBeenCalled()
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('sends at most three already-registered mails to one address within an hour', async () => {
      const service = new AccountService(
        mockUserRepository,
        inMemoryResets(),
        mockEmailService,
        { defer: queue.defer }
      )
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(mockUser)

      for (let i = 0; i < 4; i++) {
        service.register({
          username: `newuser${i}`,
          email: 'test@example.com',
          signinUrl: 'https://example.com/signin',
          resetUrl: 'https://example.com/reset',
        })
        await queue.flush()
      }

      expect(
        mockEmailService.sendEmailAlreadyRegisteredEmail
      ).toHaveBeenCalledTimes(3)
    })

    it('sends no mail for a fourth request for one account within an hour', async () => {
      const repository = inMemoryResets()
      const service = new AccountService(
        mockUserRepository,
        repository,
        mockEmailService,
        { defer: queue.defer }
      )
      vi.mocked(mockUserRepository.findByEmailHash).mockResolvedValue(mockUser)

      for (let i = 0; i < 4; i++) {
        service.requestPasswordReset({
          email: 'test@example.com',
          resetUrl: 'https://example.com/reset',
        })
        await queue.flush()
      }

      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledTimes(3)
    })

    it('should throw validation error for invalid email', () => {
      expect(() =>
        accountService.requestPasswordReset({
          email: 'invalid-email',
          resetUrl: 'https://example.com/reset',
        })
      ).toThrow('Invalid email address')
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
      expect(mockPasswordResetRepository.deleteByUserId).toHaveBeenCalledWith(
        mockPasswordResetToken.userId
      )
      expect(mockUserRepository.revokeSessionsAndTokens).toHaveBeenCalledWith(
        mockUser.id
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

    it('changes the password once when one token is submitted twice at once', async () => {
      vi.mocked(mockPasswordResetRepository.findByTokenHash).mockResolvedValue(
        mockPasswordResetToken
      )
      vi.mocked(mockPasswordResetRepository.isValidToken).mockResolvedValue(
        true
      )
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockPasswordResetRepository.consume)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)

      const results = await Promise.allSettled([
        accountService.resetPassword({
          token: 'mock-token',
          newPassword: 'FirstPassword123!',
        }),
        accountService.resetPassword({
          token: 'mock-token',
          newPassword: 'SecondPassword456!',
        }),
      ])

      expect(mockUserRepository.update).toHaveBeenCalledTimes(1)
      const rejected = results.filter(r => r.status === 'rejected')
      expect(rejected).toHaveLength(1)
      expect(rejected[0].reason).toBeInstanceOf(InvalidResetTokenError)
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
