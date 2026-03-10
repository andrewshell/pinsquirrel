import type {
  CreatePasswordResetTokenData,
  PasswordResetToken,
  PasswordResetRepository,
} from '@pinsquirrel/domain'
import { eq, and, gt, lt } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { passwordResetTokens } from '../schema/password-reset-tokens'

export class DrizzlePasswordResetRepository implements PasswordResetRepository {
  constructor(private db: MySql2Database<Record<string, unknown>>) {}

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

    await this.db.insert(passwordResetTokens).values({
      id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      createdAt: now,
    })

    const [created] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, id))
      .limit(1)

    return created
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

    await this.db
      .update(passwordResetTokens)
      .set(updateData)
      .where(eq(passwordResetTokens.id, id))

    const [updated] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, id))
      .limit(1)

    return updated || null
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, id))
    return result[0].affectedRows > 0
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await this.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId))
    return result[0].affectedRows > 0
  }

  async deleteExpiredTokens(): Promise<number> {
    const now = new Date()
    const result = await this.db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, now))
    return result[0].affectedRows
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
