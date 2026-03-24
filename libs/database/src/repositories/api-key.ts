import type {
  ApiKey,
  CreateApiKeyData,
  ApiKeyRepository,
} from '@pinsquirrel/domain'
import { eq, count } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { apiKeys } from '../schema/api-keys'

export class DrizzleApiKeyRepository implements ApiKeyRepository {
  constructor(private db: MySql2Database<Record<string, unknown>>) {}

  async findById(id: string): Promise<ApiKey | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1)
    return result[0] || null
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1)
    return result[0] || null
  }

  async findByUserId(userId: string): Promise<ApiKey[]> {
    return await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
    return result[0]?.count ?? 0
  }

  async create(data: CreateApiKeyData): Promise<ApiKey> {
    const id = crypto.randomUUID()
    const now = new Date()

    await this.db.insert(apiKeys).values({
      id,
      userId: data.userId,
      name: data.name,
      keyHash: data.keyHash,
      keyPrefix: data.keyPrefix,
      expiresAt: data.expiresAt ?? null,
      createdAt: now,
    })

    const [created] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1)

    return created
  }

  async updateLastUsed(id: string, date: Date): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: date })
      .where(eq(apiKeys.id, id))
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(apiKeys).where(eq(apiKeys.id, id))
    return result[0].affectedRows > 0
  }
}
