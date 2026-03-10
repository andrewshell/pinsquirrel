import type {
  CreateUserData,
  UpdateUserData,
  User,
  UserRepository,
  Role,
} from '@pinsquirrel/domain'
import { eq, and, sql } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { users } from '../schema/users.js'
import { userRoles } from '../schema/user-roles.js'

export class DrizzleUserRepository implements UserRepository {
  constructor(private db: MySql2Database<Record<string, unknown>>) {}

  private async attachRoles(user: User): Promise<User> {
    const roles = await this.db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, user.id))

    return {
      ...user,
      roles: roles.map(r => r.role as Role),
    }
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!result[0]) return null
    return await this.attachRoles(result[0] as User)
  }

  async findByEmailHash(emailHash: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.emailHash, emailHash))
      .limit(1)

    if (!result[0]) return null
    return await this.attachRoles(result[0] as User)
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    if (!result[0]) return null
    return await this.attachRoles(result[0] as User)
  }

  async findAll(): Promise<User[]> {
    const results = await this.db.select().from(users)
    return await Promise.all(
      results.map(user => this.attachRoles(user as User))
    )
  }

  async list(limit?: number, offset?: number): Promise<User[]> {
    let results
    if (limit !== undefined && offset !== undefined) {
      results = await this.db.select().from(users).limit(limit).offset(offset)
    } else if (limit !== undefined) {
      results = await this.db.select().from(users).limit(limit)
    } else if (offset !== undefined) {
      results = await this.db
        .select()
        .from(users)
        .limit(2147483647)
        .offset(offset)
    } else {
      results = await this.db.select().from(users)
    }

    return await Promise.all(
      results.map(user => this.attachRoles(user as User))
    )
  }

  async create(data: CreateUserData): Promise<User> {
    const id = crypto.randomUUID()
    const now = new Date()

    await this.db.insert(users).values({
      id,
      username: data.username,
      passwordHash: data.passwordHash,
      emailHash: data.emailHash || null,
      createdAt: now,
      updatedAt: now,
    })

    const [created] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    // New users start with empty roles array
    return { ...created, roles: [] } as User
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    // Update username if provided
    if (data.username !== undefined) {
      updateData.username = data.username
    }

    // Use already-hashed password if provided
    if (data.passwordHash !== undefined) {
      updateData.passwordHash = data.passwordHash
    }

    // Use already-hashed email if provided
    if (data.emailHash !== undefined) {
      updateData.emailHash = data.emailHash
    }

    await this.db.update(users).set(updateData).where(eq(users.id, id))

    const [updated] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!updated) return null
    return await this.attachRoles(updated as User)
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id))
    return result[0].affectedRows > 0
  }

  // Role management methods
  async addRole(userId: string, role: Role): Promise<void> {
    await this.db
      .insert(userRoles)
      .values({
        userId,
        role,
        createdAt: new Date(),
      })
      .onDuplicateKeyUpdate({ set: { createdAt: sql`created_at` } })
  }

  async removeRole(userId: string, role: Role): Promise<void> {
    await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
  }

  async setRoles(userId: string, roles: Role[]): Promise<void> {
    // Delete all existing roles
    await this.db.delete(userRoles).where(eq(userRoles.userId, userId))

    // Add new roles
    if (roles.length > 0) {
      const now = new Date()
      await this.db.insert(userRoles).values(
        roles.map(role => ({
          userId,
          role,
          createdAt: now,
        }))
      )
    }
  }
}
