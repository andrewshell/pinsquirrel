import type {
  CreateUserData,
  UpdateUserData,
  User,
  UserRepository,
  Role,
} from '@pinsquirrel/domain'
import { UserAlreadyExistsError, UserStatus } from '@pinsquirrel/domain'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { users } from '../schema/users.js'
import { userRoles } from '../schema/user-roles.js'
import { isDuplicateKeyError } from './duplicate-key.js'

/**
 * The enum column's values, mapped to the domain enum.
 *
 * Exhaustive by construction: a value added to the column and not to
 * `UserStatus` (or the other way round) fails to compile here rather than
 * arriving as an unrecognised status at runtime.
 */
const STATUS_BY_COLUMN: Record<
  (typeof users.$inferSelect)['status'],
  UserStatus
> = {
  unverified: UserStatus.Unverified,
  waitlist: UserStatus.Waitlist,
  active: UserStatus.Active,
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private db: MySql2Database) {}

  /**
   * Build the entity column by column, like the other repositories.
   *
   * The casts this replaces spread a row into a `User` and asserted the
   * result, so a renamed or dropped column would have compiled and failed at
   * runtime. Naming each field means the schema and the entity have to agree.
   */
  private mapToUser(row: typeof users.$inferSelect, roles: Role[]): User {
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.passwordHash,
      emailHash: row.emailHash,
      emailEncrypted: row.emailEncrypted,
      roles,
      status: STATUS_BY_COLUMN[row.status],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  private async attachRoles(row: typeof users.$inferSelect): Promise<User> {
    const rolesByUserId = await this.getRoles([row.id])

    return this.mapToUser(row, rolesByUserId.get(row.id) ?? [])
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
    return await this.attachRoles(result[0])
  }

  async findByEmailHash(emailHash: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.emailHash, emailHash))
      .limit(1)

    if (!result[0]) return null
    return await this.attachRoles(result[0])
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    if (!result[0]) return null
    return await this.attachRoles(result[0])
  }

  async findByStatus(status: UserStatus): Promise<User[]> {
    const results = await this.db
      .select()
      .from(users)
      .where(eq(users.status, status))

    const rolesByUserId = await this.getRoles(results.map(user => user.id))

    return results.map(user =>
      this.mapToUser(user, rolesByUserId.get(user.id) ?? [])
    )
  }
  /**
   * The unique indexes on `username` and `email_hash` are the ones that make
   * "one account per username/email" true — the service-level checks before
   * this call cannot, because two callers can pass them at the same moment.
   * Reporting the loser as a domain error is what lets the service treat the
   * race like any other conflict instead of knowing about mysql2 error codes.
   */
  private rethrowConflict(
    error: unknown,
    username: string,
    message?: string
  ): never {
    if (isDuplicateKeyError(error)) {
      throw new UserAlreadyExistsError(username, message)
    }
    throw error
  }

  async create(data: CreateUserData): Promise<User> {
    const id = crypto.randomUUID()
    const now = new Date()

    try {
      await this.db.insert(users).values({
        id,
        username: data.username,
        passwordHash: data.passwordHash,
        emailHash: data.emailHash || null,
        emailEncrypted: data.emailEncrypted ?? null,
        createdAt: now,
        updatedAt: now,
      })
    } catch (error) {
      this.rethrowConflict(error, data.username)
    }

    const [created] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    // New users start with empty roles array
    return this.mapToUser(created, [])
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

    try {
      await this.db.update(users).set(updateData).where(eq(users.id, id))
    } catch (error) {
      // Which of the two indexes was hit is not worth parsing out of the
      // driver message, and an update usually is not writing a username.
      this.rethrowConflict(
        error,
        data.username ?? '',
        'Another account already uses that username or email'
      )
    }

    const [updated] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!updated) return null
    return await this.attachRoles(updated)
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

  /**
   * Drop one role from one user.
   *
   * A DELETE that matches nothing is already a no-op, so the idempotence the
   * interface promises costs no extra read: two admins revoking the same role
   * from a stale listing both succeed.
   */
  async removeRole(userId: string, role: Role): Promise<void> {
    await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
  }
}
