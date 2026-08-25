import type {
  CreateUserData,
  UpdateUserData,
  User,
  UserRepository,
  Role,
  UserStatus,
} from '@pinsquirrel/domain'
import { eq, inArray, sql } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { users } from '../schema/users.js'
import { userRoles } from '../schema/user-roles.js'

export class DrizzleUserRepository implements UserRepository {
  constructor(private db: MySql2Database) {}

  private async attachRoles(user: User): Promise<User> {
    const rolesByUserId = await this.getRoles([user.id])

    return {
      ...user,
      roles: rolesByUserId.get(user.id) ?? [],
    }
  }

  /**
   * Roles for a batch of users, grouped by user id.
   *
   * `findByStatus` loads the whole admin waitlist at once, so a per-user role
   * lookup is an N+1 that grows with the waitlist.
   */
  private async getRoles(userIds: string[]): Promise<Map<string, Role[]>> {
    if (userIds.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select()
      .from(userRoles)
      .where(inArray(userRoles.userId, userIds))

    const rolesByUserId = new Map<string, Role[]>()
    for (const row of rows) {
      const existing = rolesByUserId.get(row.userId) ?? []
      existing.push(row.role as Role)
      rolesByUserId.set(row.userId, existing)
    }

    return rolesByUserId
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

  async findByStatus(status: UserStatus): Promise<User[]> {
    const results = await this.db
      .select()
      .from(users)
      .where(eq(users.status, status))

    const rolesByUserId = await this.getRoles(results.map(user => user.id))

    return results.map(user => ({
      ...(user as User),
      roles: rolesByUserId.get(user.id) ?? [],
    }))
  }
  async create(data: CreateUserData): Promise<User> {
    const id = crypto.randomUUID()
    const now = new Date()

    await this.db.insert(users).values({
      id,
      username: data.username,
      passwordHash: data.passwordHash,
      emailHash: data.emailHash || null,
      emailEncrypted: data.emailEncrypted ?? null,
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

    // Use already-sealed email if provided
    if (data.emailEncrypted !== undefined) {
      updateData.emailEncrypted = data.emailEncrypted
    }

    // Update lifecycle status if provided
    if (data.status !== undefined) {
      updateData.status = data.status
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
}
