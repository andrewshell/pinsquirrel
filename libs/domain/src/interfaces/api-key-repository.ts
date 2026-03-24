import type { ApiKey, CreateApiKeyData } from '../entities/api-key.js'

export interface ApiKeyRepository {
  findById(id: string): Promise<ApiKey | null>
  findByKeyHash(keyHash: string): Promise<ApiKey | null>
  findByUserId(userId: string): Promise<ApiKey[]>
  countByUserId(userId: string): Promise<number>
  create(data: CreateApiKeyData): Promise<ApiKey>
  updateLastUsed(id: string, date: Date): Promise<void>
  delete(id: string): Promise<boolean>
}
