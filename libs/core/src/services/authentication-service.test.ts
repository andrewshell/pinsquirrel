import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthenticationService } from './authentication-service.js'
import type { UserRepository } from '../interfaces/user-repository.js'
import type { User } from '../entities/user.js'
import {
  InvalidCredentialsError,
  UserAlreadyExistsError,
} from '../errors/auth-errors.js'

// Mock the crypto module
vi.mock('../utils/crypto.js', () => ({
  hashPassword: vi
    .fn()
    .mockImplementation((password: string) =>
      Promise.resolve(`hashed_${password}`)
    ),
  verifyPassword: vi.fn(),
  hashEmail: vi.fn().mockImplementation((email: string) => `hashed_${email}`),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
      findByEmailHash: vi.fn(),
      findByUsername: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    }
    authService = new AuthenticationService(mockUserRepository)
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
      ).rejects.toThrow('Invalid username')
    })

    it('should throw validation error for invalid password', async () => {
      await expect(
        authService.register('testuser', 'short') // too short
      ).rejects.toThrow('Invalid password')
    })

    it('should throw validation error for invalid email', async () => {
      await expect(
        authService.register('testuser', 'password123', 'invalid-email')
      ).rejects.toThrow('Invalid email')
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
      ).rejects.toThrow('Invalid email')
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
      ).rejects.toThrow('Invalid username')
    })

    it('should throw validation error for invalid password', async () => {
      await expect(
        authService.login('testuser', 'short') // too short
      ).rejects.toThrow('Invalid password')
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
      ).rejects.toThrow('Invalid current password')
    })

    it('should throw validation error for invalid new password', async () => {
      await expect(
        authService.changePassword('123', 'currentpass123', 'short') // new password too short
      ).rejects.toThrow('Invalid new password')
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
      ).rejects.toThrow('Invalid email')
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
})
