import type {
  AccessControl,
  ApiKey,
  ApiKeyRepository,
} from '@pinsquirrel/domain'
import {
  ApiKeyLimitExceededError,
  ApiKeyNotFoundError,
  UnauthorizedApiKeyAccessError,
  ValidationError,
} from '@pinsquirrel/domain'
import { generateSecureToken, hashToken } from '../utils/crypto.js'
import { apiKeyNameSchema } from '../validation/api-key.js'

const MAX_KEYS_PER_USER = 5

export class ApiKeyService {
  constructor(private readonly apiKeyRepository: ApiKeyRepository) {}

  async createApiKey(
    ac: AccessControl,
    input: { userId: string; name: string; expiresAt?: Date | null }
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    if (!ac.canCreateAs(input.userId)) {
      throw new UnauthorizedApiKeyAccessError(
        'User can only create API keys for themselves'
      )
    }

    const result = apiKeyNameSchema.safeParse(input.name)
    if (!result.success) {
      const errors: Record<string, string[]> = {}
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || 'name'
        if (!errors[field]) {
          errors[field] = []
        }
        errors[field].push(issue.message)
      }
      throw new ValidationError(errors)
    }

    const count = await this.apiKeyRepository.countByUserId(input.userId)
    if (count >= MAX_KEYS_PER_USER) {
      throw new ApiKeyLimitExceededError()
    }

    const rawKey = 'ps_' + generateSecureToken()
    const keyHash = hashToken(rawKey)
    const keyPrefix = rawKey.substring(0, 8)

    const apiKey = await this.apiKeyRepository.create({
      userId: input.userId,
      name: result.data,
      keyHash,
      keyPrefix,
      expiresAt: input.expiresAt,
    })

    return { apiKey, rawKey }
  }

  async listApiKeys(ac: AccessControl, userId: string): Promise<ApiKey[]> {
    if (!ac.canCreateAs(userId)) {
      throw new UnauthorizedApiKeyAccessError()
    }

    return this.apiKeyRepository.findByUserId(userId)
  }

  async revokeApiKey(ac: AccessControl, keyId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findById(keyId)
    if (!apiKey) {
      throw new ApiKeyNotFoundError()
    }

    if (!ac.canDelete(apiKey)) {
      throw new UnauthorizedApiKeyAccessError()
    }

    await this.apiKeyRepository.delete(keyId)
  }

  async authenticateByKey(rawKey: string): Promise<ApiKey | null> {
    const keyHash = hashToken(rawKey)
    const apiKey = await this.apiKeyRepository.findByKeyHash(keyHash)

    if (!apiKey) {
      return null
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null
    }

    await this.apiKeyRepository.updateLastUsed(apiKey.id, new Date())

    return apiKey
  }
}
