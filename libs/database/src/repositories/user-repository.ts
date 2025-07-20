import { eq } from 'drizzle-orm'
import type {
  User,
  CreateUserData,
  UpdateUserData,
  UserRepository,
} from '@pinsquirrel/core'
import { db as defaultDb } from '../client.js'
import { users } from '../schema/users.js'

export class DrizzleUserRepository implements UserRepository {
  private db: typeof defaultDb

  constructor(database?: typeof defaultDb) {
    this.db = database || defaultDb
  }
  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    return result[0] || null
  }

  async findByEmailHash(emailHash: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.emailHash, emailHash))
      .limit(1)

    return result[0] || null
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
    return result[0] || null
  }

  async findAll(): Promise<User[]> {
    return await this.db.select().from(users)
  }

  async list(limit?: number, offset?: number): Promise<User[]> {
    if (limit !== undefined && offset !== undefined) {
      return await this.db.select().from(users).limit(limit).offset(offset)
    } else if (limit !== undefined) {
      return await this.db.select().from(users).limit(limit)
    } else if (offset !== undefined) {
      return await this.db.select().from(users).offset(offset)
    }

    return await this.db.select().from(users)
  }

  async create(data: CreateUserData): Promise<User> {
    const id = crypto.randomUUID()
    const now = new Date()

    const result = await this.db
      .insert(users)
      .values({
        id,
        username: data.username,
        passwordHash: data.passwordHash,
        emailHash: data.emailHash || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return result[0]
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    // Use already-hashed password if provided
    if (data.passwordHash !== undefined) {
      updateData.passwordHash = data.passwordHash
    }

    // Use already-hashed email if provided
    if (data.emailHash !== undefined) {
      updateData.emailHash = data.emailHash
    }

    const result = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning()

    return result[0] || null
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id))
    return (result.rowCount ?? 0) > 0
  }
}
