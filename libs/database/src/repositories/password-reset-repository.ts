import type {
  CreatePasswordResetTokenData,
  PasswordResetToken,
  PasswordResetRepository,
} from '@pinsquirrel/core'
import { eq, and, gt, lt } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { passwordResetTokens } from '../schema/password-reset-tokens'

export class DrizzlePasswordResetRepository implements PasswordResetRepository {
  constructor(private db: PostgresJsDatabase<Record<string, unknown>>) {}

  async findById(id: string): Promise<PasswordResetToken | null> {
    const result = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, id))
      .limit(1)
    return result[0] || null
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const result = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1)
    return result[0] || null
  }

  async findByUserId(userId: string): Promise<PasswordResetToken[]> {
    return await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId))
  }

  async findAll(): Promise<PasswordResetToken[]> {
    return await this.db.select().from(passwordResetTokens)
  }

  async create(
    data: CreatePasswordResetTokenData
  ): Promise<PasswordResetToken> {
    const id = crypto.randomUUID()
    const now = new Date()

    const result = await this.db
      .insert(passwordResetTokens)
      .values({
        id,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        createdAt: now,
      })
      .returning()

    return result[0]
  }

  async update(
    id: string,
    data: Partial<CreatePasswordResetTokenData>
  ): Promise<PasswordResetToken | null> {
    const updateData: Record<string, unknown> = {}

    if (data.tokenHash !== undefined) {
      updateData.tokenHash = data.tokenHash
    }

    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt
    }

    if (Object.keys(updateData).length === 0) {
      return await this.findById(id)
    }

    const result = await this.db
      .update(passwordResetTokens)
      .set(updateData)
      .where(eq(passwordResetTokens.id, id))
      .returning()

    return result[0] || null
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, id))
    return result.rowCount > 0
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await this.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId))
    return result.rowCount > 0
  }

  async deleteExpiredTokens(): Promise<number> {
    const now = new Date()
    const result = await this.db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, now))
    return result.rowCount
  }

  async isValidToken(tokenHash: string): Promise<boolean> {
    const now = new Date()
    const result = await this.db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1)

    return result.length > 0
  }
}
