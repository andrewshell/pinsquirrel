import type {
  Session,
  CreateSessionData,
  UpdateSessionData,
  SessionDataPatch,
  SessionRepository,
} from '@pinsquirrel/domain'
import { eq, lt, sql } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { sessions } from '../schema/sessions'

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private db: MySql2Database) {}

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

  async create(data: CreateSessionData): Promise<Session> {
    const now = new Date()

    await this.db.insert(sessions).values({
      id: data.id,
      userId: data.userId,
      data: data.data ?? null,
      expiresAt: data.expiresAt,
      createdAt: now,
    })

    const [created] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, data.id))
      .limit(1)

    return created
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

    await this.db.update(sessions).set(updateData).where(eq(sessions.id, id))

    const [updated] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1)

    return updated || null
  }

  async patchData(id: string, patch: SessionDataPatch): Promise<void> {
    const path = (key: string) => `$.${JSON.stringify(key)}`
    let data = sql`COALESCE(${sessions.data}, JSON_OBJECT())`
    const entries = Object.entries(patch.set)
    if (entries.length > 0) {
      const pairs = entries.map(
        ([key, value]) =>
          sql`${path(key)}, CAST(${JSON.stringify(value)} AS JSON)`
      )
      data = sql`JSON_SET(${data}, ${sql.join(pairs, sql`, `)})`
    }
    if (patch.unset.length > 0) {
      const paths = patch.unset.map(key => sql`${path(key)}`)
      data = sql`JSON_REMOVE(${data}, ${sql.join(paths, sql`, `)})`
    }
    await this.db.update(sessions).set({ data }).where(eq(sessions.id, id))
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(sessions).where(eq(sessions.id, id))
    return result[0].affectedRows > 0
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await this.db
      .delete(sessions)
      .where(eq(sessions.userId, userId))
    return result[0].affectedRows > 0
  }

  async deleteExpiredSessions(): Promise<number> {
    const now = new Date()
    const result = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
    return result[0].affectedRows
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
