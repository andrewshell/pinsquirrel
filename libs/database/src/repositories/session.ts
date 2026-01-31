import type {
  Session,
  CreateSessionData,
  UpdateSessionData,
  SessionRepository,
} from '@pinsquirrel/domain'
import { eq, lt } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { sessions } from '../schema/sessions'

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private db: PostgresJsDatabase<Record<string, unknown>>) {}

  async findById(id: string): Promise<Session | null> {
    const result = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1)
    return result[0] || null
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
  }

  async findAll(): Promise<Session[]> {
    return await this.db.select().from(sessions)
  }

  async create(data: CreateSessionData): Promise<Session> {
    const id = crypto.randomUUID()
    const now = new Date()

    const result = await this.db
      .insert(sessions)
      .values({
        id,
        userId: data.userId,
        data: data.data ?? null,
        expiresAt: data.expiresAt,
        createdAt: now,
      })
      .returning()

    return result[0]
  }

  async update(id: string, data: UpdateSessionData): Promise<Session | null> {
    const updateData: Record<string, unknown> = {}

    if (data.data !== undefined) {
      updateData.data = data.data
    }

    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt
    }

    if (Object.keys(updateData).length === 0) {
      return await this.findById(id)
    }

    const result = await this.db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, id))
      .returning()

    return result[0] || null
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(sessions).where(eq(sessions.id, id))
    return result.rowCount > 0
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await this.db
      .delete(sessions)
      .where(eq(sessions.userId, userId))
    return result.rowCount > 0
  }

  async deleteExpiredSessions(): Promise<number> {
    const now = new Date()
    const result = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
    return result.rowCount
  }

  async isValidSession(id: string): Promise<boolean> {
    const now = new Date()
    const session = await this.findById(id)

    if (!session) {
      return false
    }

    return session.expiresAt > now
  }
}
