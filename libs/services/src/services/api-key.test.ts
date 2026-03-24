import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApiKeyService } from './api-key.js'
import type { ApiKeyRepository, ApiKey, User } from '@pinsquirrel/domain'
import {
  AccessControl,
  ApiKeyNotFoundError,
  ApiKeyLimitExceededError,
  UnauthorizedApiKeyAccessError,
  ValidationError,
  Role,
} from '@pinsquirrel/domain'

vi.mock('../utils/crypto.js', () => ({
  generateSecureToken: vi.fn().mockReturnValue('mock-secure-token'),
  hashToken: vi.fn().mockImplementation((token: string) => `hashed_${token}`),
}))

describe('ApiKeyService', () => {
  let service: ApiKeyService
  let mockRepo: ApiKeyRepository

  const userId = '123e4567-e89b-12d3-a456-426614174000'

  const mockUser: User = {
    id: userId,
    username: 'testuser',
    passwordHash: 'hashedpassword',
    emailHash: null,
    roles: [Role.User],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const otherUser: User = {
    id: 'other-user-id',
    username: 'otheruser',
    passwordHash: 'hashedpassword',
    emailHash: null,
    roles: [Role.User],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockApiKey: ApiKey = {
    id: 'key-1',
    userId,
    name: 'My Key',
    keyHash: 'hashed_ps_mock-secure-token',
    keyPrefix: 'ps_mock-',
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-01-01'),
  }

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByKeyHash: vi.fn(),
      findByUserId: vi.fn(),
      countByUserId: vi.fn(),
      create: vi.fn(),
      updateLastUsed: vi.fn(),
      delete: vi.fn(),
    }
    service = new ApiKeyService(mockRepo)
  })

  describe('createApiKey', () => {
    it('creates an API key and returns the raw key', async () => {
      const ac = new AccessControl(mockUser)
      vi.mocked(mockRepo.countByUserId).mockResolvedValue(0)
      vi.mocked(mockRepo.create).mockResolvedValue(mockApiKey)

      const result = await service.createApiKey(ac, {
        userId,
        name: 'My Key',
      })

      expect(result.rawKey).toBe('ps_mock-secure-token')
      expect(result.apiKey).toEqual(mockApiKey)
      expect(mockRepo.create).toHaveBeenCalledWith({
        userId,
        name: 'My Key',
        keyHash: 'hashed_ps_mock-secure-token',
        keyPrefix: 'ps_mock-',
        expiresAt: undefined,
      })
    })

    it('throws ValidationError for empty name', async () => {
      const ac = new AccessControl(mockUser)

      await expect(
        service.createApiKey(ac, { userId, name: '' })
      ).rejects.toThrow(ValidationError)
    })

    it('throws ValidationError for name exceeding 100 characters', async () => {
      const ac = new AccessControl(mockUser)

      await expect(
        service.createApiKey(ac, { userId, name: 'a'.repeat(101) })
      ).rejects.toThrow(ValidationError)
    })

    it('throws ApiKeyLimitExceededError when user has 5 keys', async () => {
      const ac = new AccessControl(mockUser)
      vi.mocked(mockRepo.countByUserId).mockResolvedValue(5)

      await expect(
        service.createApiKey(ac, { userId, name: 'My Key' })
      ).rejects.toThrow(ApiKeyLimitExceededError)
    })

    it('throws when user cannot create as the specified userId', async () => {
      const ac = new AccessControl(otherUser)

      await expect(
        service.createApiKey(ac, { userId, name: 'My Key' })
      ).rejects.toThrow(UnauthorizedApiKeyAccessError)
    })
  })

  describe('listApiKeys', () => {
    it('returns keys for authorized user', async () => {
      const ac = new AccessControl(mockUser)
      vi.mocked(mockRepo.findByUserId).mockResolvedValue([mockApiKey])

      const result = await service.listApiKeys(ac, userId)

      expect(result).toEqual([mockApiKey])
      expect(mockRepo.findByUserId).toHaveBeenCalledWith(userId)
    })

    it('throws when user is not authorized', async () => {
      const ac = new AccessControl(otherUser)

      await expect(service.listApiKeys(ac, userId)).rejects.toThrow(
        UnauthorizedApiKeyAccessError
      )
    })
  })

  describe('revokeApiKey', () => {
    it('deletes the key when authorized', async () => {
      const ac = new AccessControl(mockUser)
      vi.mocked(mockRepo.findById).mockResolvedValue(mockApiKey)
      vi.mocked(mockRepo.delete).mockResolvedValue(true)

      await service.revokeApiKey(ac, 'key-1')

      expect(mockRepo.delete).toHaveBeenCalledWith('key-1')
    })

    it('throws ApiKeyNotFoundError when key does not exist', async () => {
      const ac = new AccessControl(mockUser)
      vi.mocked(mockRepo.findById).mockResolvedValue(null)

      await expect(service.revokeApiKey(ac, 'key-1')).rejects.toThrow(
        ApiKeyNotFoundError
      )
    })

    it('throws when user does not own the key', async () => {
      const ac = new AccessControl(otherUser)
      vi.mocked(mockRepo.findById).mockResolvedValue(mockApiKey)

      await expect(service.revokeApiKey(ac, 'key-1')).rejects.toThrow(
        UnauthorizedApiKeyAccessError
      )
    })
  })

  describe('authenticateByKey', () => {
    it('returns the API key for a valid raw key', async () => {
      vi.mocked(mockRepo.findByKeyHash).mockResolvedValue(mockApiKey)

      const result = await service.authenticateByKey('ps_mock-secure-token')

      expect(result).toEqual(mockApiKey)
      expect(mockRepo.findByKeyHash).toHaveBeenCalledWith(
        'hashed_ps_mock-secure-token'
      )
      expect(mockRepo.updateLastUsed).toHaveBeenCalledWith(
        'key-1',
        expect.any(Date)
      )
    })

    it('returns null for an unknown key', async () => {
      vi.mocked(mockRepo.findByKeyHash).mockResolvedValue(null)

      const result = await service.authenticateByKey('ps_unknown-key')

      expect(result).toBeNull()
      expect(mockRepo.updateLastUsed).not.toHaveBeenCalled()
    })

    it('returns null for an expired key', async () => {
      const expiredKey: ApiKey = {
        ...mockApiKey,
        expiresAt: new Date('2020-01-01'),
      }
      vi.mocked(mockRepo.findByKeyHash).mockResolvedValue(expiredKey)

      const result = await service.authenticateByKey('ps_mock-secure-token')

      expect(result).toBeNull()
      expect(mockRepo.updateLastUsed).not.toHaveBeenCalled()
    })

    it('does not return null for a key with no expiration', async () => {
      vi.mocked(mockRepo.findByKeyHash).mockResolvedValue(mockApiKey)

      const result = await service.authenticateByKey('ps_mock-secure-token')

      expect(result).not.toBeNull()
    })
  })
})
