export interface ApiKey {
  id: string
  userId: string
  name: string
  keyHash: string
  keyPrefix: string
  lastUsedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

export interface CreateApiKeyData {
  userId: string
  name: string
  keyHash: string
  keyPrefix: string
  expiresAt?: Date | null
}
