import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthenticationServiceImpl } from './authentication-service.js'
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
  let authService: AuthenticationServiceImpl
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
    authService = new AuthenticationServiceImpl(mockUserRepository)
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
  })

  describe('changePassword', () => {
    it('should update password with valid current password', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(mockUserRepository.update).mockResolvedValue(mockUser)
      vi.mocked(verifyPassword).mockResolvedValue(true)

      await authService.changePassword('123', 'currentpass', 'newpass')

      expect(mockUserRepository.findById).toHaveBeenCalledWith('123')
      expect(verifyPassword).toHaveBeenCalledWith(
        'currentpass',
        mockUser.passwordHash
      )
      expect(mockUserRepository.update).toHaveBeenCalledWith('123', {
        passwordHash: 'hashed_newpass',
      })
    })

    it('should throw InvalidCredentialsError for wrong current password', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
      vi.mocked(verifyPassword).mockResolvedValue(false)

      await expect(
        authService.changePassword('123', 'wrongpass', 'newpass')
      ).rejects.toThrow(InvalidCredentialsError)

      expect(mockUserRepository.update).not.toHaveBeenCalled()
    })

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

      await expect(
        authService.changePassword('999', 'currentpass', 'newpass')
      ).rejects.toThrow(InvalidCredentialsError)
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
  })
})
