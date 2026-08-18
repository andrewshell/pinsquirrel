import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthenticationService } from './authentication.js'
import type { UserRepository, User } from '@pinsquirrel/domain'
import {
  InvalidCredentialsError,
  MissingRoleError,
  AccessNotGrantedError,
  UserNotFoundError,
  UserNotEligibleError,
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
  verifyPassword: vi.fn(),
  hashEmail: vi.fn().mockImplementation((email: string) => `hashed_${email}`),
  generateSecureToken: vi.fn().mockReturnValue('mock-token'),
  hashToken: vi.fn().mockImplementation((token: string) => `hashed_${token}`),
  getDummyHash: vi.fn().mockReturnValue('dummy_salt:dummy_key'),
}))

import { verifyPassword } from '../utils/crypto.js'

describe('AuthenticationService', () => {
  let authService: AuthenticationService
  let mockUserRepository: UserRepository

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

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
      findByEmailHash: vi.fn(),
      findByUsername: vi.fn(),
      findByStatus: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addRole: vi.fn(),
    }

    authService = new AuthenticationService(mockUserRepository)
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

      const loginInput = {
        username: 'testuser',
        password: 'password12345',
      }

      const result = await authService.login(loginInput)

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser')
      expect(verifyPassword).toHaveBeenCalledWith(
        'password12345',
        '$2b$10$validhash'
      )
      expect(result).toEqual(userWithPassword)
    })

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null)
      vi.mocked(verifyPassword).mockResolvedValue(false)

      const loginInput = {
        username: 'nonexistent',
        password: 'password12345',
      }

      await expect(authService.login(loginInput)).rejects.toThrow(
        InvalidCredentialsError
      )
      // verifyPassword should still be called (timing side-channel mitigation)
      expect(verifyPassword).toHaveBeenCalledWith(
        'password12345',
        'dummy_salt:dummy_key'
      )
    })

    it('should throw InvalidCredentialsError for user without password hash', async () => {
      const userWithoutPassword = { ...mockUser, passwordHash: null }
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(
        userWithoutPassword
      )
      vi.mocked(verifyPassword).mockResolvedValue(false)

      const loginInput = {
        username: 'testuser',
        password: 'password12345',
      }

      await expect(authService.login(loginInput)).rejects.toThrow(
        InvalidCredentialsError
      )
      // Should use dummy hash when passwordHash is null
      expect(verifyPassword).toHaveBeenCalledWith(
        'password12345',
        'dummy_salt:dummy_key'
      )
    })

    it('should throw InvalidCredentialsError for wrong password', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser)
      vi.mocked(verifyPassword).mockResolvedValue(false)

      const loginInput = {
        username: 'testuser',
        password: 'wrongpassword',
      }

      await expect(authService.login(loginInput)).rejects.toThrow(
        InvalidCredentialsError
      )
    })

    it('should throw MissingRoleError when user does not have User role', async () => {
      const userWithoutRole = {
        ...mockUser,
        roles: [], // No roles assigned
        passwordHash: '$2b$10$validhash',
      }
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(
        userWithoutRole
      )
      vi.mocked(verifyPassword).mockResolvedValue(true)

      const loginInput = {
        username: 'testuser',
        password: 'password12345',
      }

      await expect(authService.login(loginInput)).rejects.toThrow(
        MissingRoleError
      )
    })

    it('should throw AccessNotGrantedError when a waitlisted user signs in', async () => {
      const waitlistedUser = {
        ...mockUser,
        status: UserStatus.Waitlist,
        passwordHash: '$2b$10$validhash',
      }
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(
        waitlistedUser
      )
      vi.mocked(verifyPassword).mockResolvedValue(true)

      await expect(
        authService.login({
          username: 'testuser',
          password: 'password12345',
        })
      ).rejects.toThrow(AccessNotGrantedError)
    })

    it('should throw validation error for invalid username', async () => {
      const loginInput = {
        username: 'ab', // too short
        password: 'password12345',
      }

      await expect(authService.login(loginInput)).rejects.toThrow(
        'Username must be at least 3 characters'
      )
    })

    it('should throw validation error for invalid password', async () => {
      const loginInput = {
        username: 'testuser',
        password: 'short', // too short
      }

      await expect(authService.login(loginInput)).rejects.toThrow(
        'Password must be at least 12 characters'
      )
    })
  })

  describe('grantAccess', () => {
    it('should move a waitlisted user to active', async () => {
      const waitlistedUser = { ...mockUser, status: UserStatus.Waitlist }
      const activatedUser = { ...mockUser, status: UserStatus.Active }
      vi.mocked(mockUserRepository.findById).mockResolvedValue(waitlistedUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(activatedUser)

      const result = await authService.grantAccess(waitlistedUser.id)

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        waitlistedUser.id,
        { status: UserStatus.Active }
      )
      expect(result.status).toBe(UserStatus.Active)
    })

    it('should be idempotent for an already-active user', async () => {
      const activeUser = { ...mockUser, status: UserStatus.Active }
      vi.mocked(mockUserRepository.findById).mockResolvedValue(activeUser)

      const result = await authService.grantAccess(activeUser.id)

      expect(mockUserRepository.update).not.toHaveBeenCalled()
      expect(result.status).toBe(UserStatus.Active)
    })

    it('should throw UserNotFoundError when the user does not exist', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

      await expect(authService.grantAccess('missing-id')).rejects.toThrow(
        UserNotFoundError
      )
      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    // Activating an unverified account would strand it as Active with no
    // password. Setting one later runs resetPassword, whose Unverified guard
    // no longer matches, so the account would be signed in having never been
    // on the waitlist at all.
    it('should refuse an unverified user rather than skipping the waitlist', async () => {
      const unverified = {
        ...mockUser,
        status: UserStatus.Unverified,
        passwordHash: null,
      }
      vi.mocked(mockUserRepository.findById).mockResolvedValue(unverified)

      await expect(authService.grantAccess(unverified.id)).rejects.toThrow(
        UserNotEligibleError
      )
      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('grantAdmin', () => {
    it('should add the Admin role to a user who lacks it', async () => {
      const plainUser = { ...mockUser, roles: [Role.User] }
      const adminUser = { ...mockUser, roles: [Role.User, Role.Admin] }
      vi.mocked(mockUserRepository.findById)
        .mockResolvedValueOnce(plainUser)
        .mockResolvedValueOnce(adminUser)

      const result = await authService.grantAdmin(plainUser.id)

      expect(mockUserRepository.addRole).toHaveBeenCalledWith(
        plainUser.id,
        Role.Admin
      )
      expect(result.roles).toContain(Role.Admin)
    })

    it('should preserve existing roles rather than replacing them', async () => {
      const plainUser = { ...mockUser, roles: [Role.User] }
      const adminUser = { ...mockUser, roles: [Role.User, Role.Admin] }
      vi.mocked(mockUserRepository.findById)
        .mockResolvedValueOnce(plainUser)
        .mockResolvedValueOnce(adminUser)

      const result = await authService.grantAdmin(plainUser.id)

      expect(result.roles).toContain(Role.User)
      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('should be idempotent for an existing admin', async () => {
      const adminUser = { ...mockUser, roles: [Role.User, Role.Admin] }
      vi.mocked(mockUserRepository.findById).mockResolvedValue(adminUser)

      const result = await authService.grantAdmin(adminUser.id)

      expect(mockUserRepository.addRole).not.toHaveBeenCalled()
      expect(result.roles).toContain(Role.Admin)
    })

    it('should throw UserNotFoundError when the user does not exist', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

      await expect(authService.grantAdmin('missing-id')).rejects.toThrow(
        UserNotFoundError
      )
      expect(mockUserRepository.addRole).not.toHaveBeenCalled()
    })

    it('should throw UserNotFoundError if the user vanishes after the role write', async () => {
      const plainUser = { ...mockUser, roles: [Role.User] }
      vi.mocked(mockUserRepository.findById)
        .mockResolvedValueOnce(plainUser)
        .mockResolvedValueOnce(null)

      await expect(authService.grantAdmin(plainUser.id)).rejects.toThrow(
        UserNotFoundError
      )
    })
  })

  describe('changePassword', () => {
    it('should update password with valid current password', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)
      vi.mocked(verifyPassword).mockResolvedValue(true)

      await authService.changePassword({
        userId: '123',
        currentPassword: 'currentpass123',
        newPassword: 'newpass1234567',
      })

      expect(mockUserRepository.findById).toHaveBeenCalledWith('123')
      expect(verifyPassword).toHaveBeenCalledWith(
        'currentpass123',
        mockUser.passwordHash
      )
      // Only the field this operation owns — not username/emailHash, which a
      // concurrent change could have updated after the findById read.
      expect(mockUserRepository.update).toHaveBeenCalledWith('123', {
        passwordHash: 'hashed_newpass1234567',
      })
    })

    it('should throw InvalidCredentialsError for wrong current password', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(verifyPassword).mockResolvedValue(false)

      await expect(
        authService.changePassword({
          userId: '123',
          currentPassword: 'wrongpass123',
          newPassword: 'newpass1234567',
        })
      ).rejects.toThrow(InvalidCredentialsError)

      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

      await expect(
        authService.changePassword({
          userId: '999',
          currentPassword: 'currentpass123',
          newPassword: 'newpass1234567',
        })
      ).rejects.toThrow(InvalidCredentialsError)
    })

    it('should throw validation error for invalid current password', async () => {
      await expect(
        authService.changePassword({
          userId: '123',
          currentPassword: 'short', // too short
          newPassword: 'newpass1234567',
        })
      ).rejects.toThrow('Password must be at least 12 characters')
    })

    it('should throw validation error for invalid new password', async () => {
      await expect(
        authService.changePassword({
          userId: '123',
          currentPassword: 'currentpass123',
          newPassword: 'short', // too short
        })
      ).rejects.toThrow('Password must be at least 12 characters')
    })
  })
})
