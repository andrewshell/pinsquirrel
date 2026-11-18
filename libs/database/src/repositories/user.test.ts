import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { Pool, RowDataPacket } from 'mysql2/promise'
import {
  heavyTransaction,
  impatientDatabase,
  insertUser,
  transactionHolding,
} from '../test-fixtures.js'
import { DrizzleOAuthAuthorizationCodeRepository } from './oauth-authorization-code.js'
import { DrizzleOAuthClientRepository } from './oauth-client.js'
import { DrizzleOAuthTokenRepository } from './oauth-token.js'
import { DrizzlePasswordResetRepository } from './password-reset.js'
import { DrizzleSessionRepository } from './session.js'
import { DrizzleEmailChangeRepository } from './email-change.js'
import { DrizzleUserRepository } from './user.js'
import {
  Role,
  UserAlreadyExistsError,
  UserStatus,
  WriteConflictError,
} from '@pinsquirrel/domain'

describe('DrizzleUserRepository - Integration Tests', () => {
  let testDb: MySql2Database
  let testPool: Pool
  let repository: DrizzleUserRepository

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel_test'

  beforeAll(() => {
    // Create test database connection
    testPool = mysql.createPool(TEST_DATABASE_URL)

    testDb = drizzle({ client: testPool })
  })

  afterAll(async () => {
    await testPool.end()
  })

  beforeEach(async () => {
    // Create repository with test database
    repository = new DrizzleUserRepository(testDb)

    // Clean up any existing test data (respecting foreign key constraints)
    await testPool.query('DELETE FROM pins_tags')
    await testPool.query('DELETE FROM pins')
    await testPool.query('DELETE FROM password_reset_tokens')
    await testPool.query('DELETE FROM sessions')
    await testPool.query('DELETE FROM tags')
    await testPool.query('DELETE FROM user_roles')
    await testPool.query('DELETE FROM users')
  })

  describe('findById', () => {
    it('should find user by id', async () => {
      const { id: userId, username } = await insertUser(testPool)

      const result = await repository.findById(userId)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(userId)
      expect(result!.username).toBe(username)
      expect(result!.passwordHash).toBe('hashed_password')
      expect(result!.emailHash).toBe('hashed_email')
    })

    it('should return null when user not found', async () => {
      const nonexistentId = crypto.randomUUID()
      const result = await repository.findById(nonexistentId)
      expect(result).toBeNull()
    })
  })

  describe('findByEmailHash', () => {
    it('should find user by email hash', async () => {
      await insertUser(testPool, { emailHash: 'specific_email_hash' })

      const result = await repository.findByEmailHash('specific_email_hash')

      expect(result).not.toBeNull()
      expect(result!.emailHash).toBe('specific_email_hash')
    })

    it('should return null when user not found by email hash', async () => {
      const result = await repository.findByEmailHash('nonexistent_hash')
      expect(result).toBeNull()
    })
  })

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      const { username } = await insertUser(testPool, {
        username: `specific_username-${crypto.randomUUID().slice(0, 8)}`,
      })

      const result = await repository.findByUsername(username)

      expect(result).not.toBeNull()
      expect(result!.username).toBe(username)
    })

    it('should return null when user not found', async () => {
      const result = await repository.findByUsername('nonexistent')
      expect(result).toBeNull()
    })

    it('loads the user with all of its roles', async () => {
      const created = await repository.create({
        username: `roles-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'h',
        emailHash: null,
        roles: [Role.User, Role.Admin],
      })

      const found = await repository.findByUsername(created.username)

      expect(found?.roles.sort()).toEqual([Role.Admin, Role.User].sort())
    })

    it('makes the same number of queries whether or not the user exists', async () => {
      const { username } = await insertUser(testPool)
      const queries: string[] = []
      const counted = new DrizzleUserRepository(
        drizzle({
          client: testPool,
          logger: { logQuery: query => queries.push(query) },
        })
      )

      await counted.findByUsername(username)
      const forExisting = queries.length
      queries.length = 0
      await counted.findByUsername(`missing-${crypto.randomUUID()}`)

      expect(queries.length).toBe(forExisting)
    })
  })
  describe('findByStatus', () => {
    it('returns only users with the given status', async () => {
      const waitlisted = await repository.create({
        username: `wl-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'h',
        emailHash: null,
        emailEncrypted: 'sealed-blob',
      })
      await repository.update(waitlisted.id, { status: UserStatus.Waitlist })

      const active = await repository.create({
        username: `act-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'h',
        emailHash: null,
      })
      await repository.update(active.id, { status: UserStatus.Active })

      const result = await repository.findByStatus(UserStatus.Waitlist)

      const ids = result.map(u => u.id)
      expect(ids).toContain(waitlisted.id)
      expect(ids).not.toContain(active.id)
      expect(result.every(u => u.status === UserStatus.Waitlist)).toBe(true)
      // Email ciphertext is carried through so the admin app can decrypt it
      expect(result.find(u => u.id === waitlisted.id)?.emailEncrypted).toBe(
        'sealed-blob'
      )
    })

    it('loads every users roles in a single query', async () => {
      // The admin waitlist calls this for the whole waitlist at once, so a
      // per-user role lookup is an N+1 that grows with the waitlist.
      const created = []
      for (let i = 0; i < 3; i++) {
        const user = await repository.create({
          username: `roles-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'h',
          emailHash: null,
        })
        await repository.update(user.id, { status: UserStatus.Waitlist })
        await repository.addRole(user.id, Role.User)
        await repository.addRole(user.id, Role.Admin)
        created.push(user)
      }

      const querySpy = vi.spyOn(testPool, 'query')
      let result: Awaited<ReturnType<typeof repository.findByStatus>>
      let roleQueries: number
      try {
        result = await repository.findByStatus(UserStatus.Waitlist)
        roleQueries = querySpy.mock.calls.filter(call => {
          const first = call[0]
          const text = typeof first === 'string' ? first : (first?.sql ?? '')
          return text.includes('user_roles')
        }).length
      } finally {
        // mockRestore also clears mock.calls, so read them first.
        querySpy.mockRestore()
      }
      expect(roleQueries).toBe(1)

      expect(result).toHaveLength(created.length)
      for (const user of created) {
        const loaded = result.find(u => u.id === user.id)
        expect(loaded).toBeDefined()
        expect([...loaded!.roles].sort()).toEqual([Role.Admin, Role.User])
      }
    })
  })
  describe('create', () => {
    it('should create user with username and password hash', async () => {
      const createData = {
        username: `newuser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'already_hashed_password',
        emailHash: null,
      }

      const result = await repository.create(createData)

      expect(result.username).toBe(createData.username)
      expect(result.passwordHash).toBe('already_hashed_password')
      expect(result.emailHash).toBeNull()
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      // Verify it was actually saved to database
      const saved = await repository.findById(result.id)
      expect(saved).toEqual(result)
    })

    it('should create user with username, password hash and email hash', async () => {
      const createData = {
        username: `newuser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'already_hashed_password',
        emailHash: 'already_hashed_email',
      }

      const result = await repository.create(createData)

      expect(result.emailHash).toBe('already_hashed_email')

      // Verify it was actually saved to database
      const saved = await repository.findById(result.id)
      expect(saved?.emailHash).toBe('already_hashed_email')
    })

    it('should create user with undefined email hash as null', async () => {
      const createData = {
        username: `newuser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'already_hashed_password',
        emailHash: null,
      }

      const result = await repository.create(createData)

      expect(result.emailHash).toBeNull()

      // Verify it was actually saved to database
      const saved = await repository.findById(result.id)
      expect(saved?.emailHash).toBeNull()
    })

    it('creates the user with the roles it is given', async () => {
      const result = await repository.create({
        username: `newuser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: null,
        emailHash: null,
        roles: [Role.User],
      })

      expect(result.roles).toEqual([Role.User])
      expect((await repository.findById(result.id))?.roles).toEqual([Role.User])
    })

    it('leaves no user behind when a role cannot be written', async () => {
      const username = `newuser-${crypto.randomUUID().slice(0, 8)}`

      await expect(
        repository.create({
          username,
          passwordHash: null,
          emailHash: null,
          roles: ['x'.repeat(300) as Role],
        })
      ).rejects.toThrow()

      expect(await repository.findByUsername(username)).toBeNull()
    })

    it('should default new users to unverified status', async () => {
      const createData = {
        username: `newuser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: null,
        emailHash: null,
        emailEncrypted: null,
      }

      const result = await repository.create(createData)

      expect(result.status).toBe(UserStatus.Unverified)

      // Verify it was actually persisted
      const saved = await repository.findById(result.id)
      expect(saved?.status).toBe(UserStatus.Unverified)
    })

    it('should persist the sealed (encrypted) email', async () => {
      const createData = {
        username: `newuser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: null,
        emailHash: 'hash',
        emailEncrypted: 'sealed-blob-base64',
      }

      const result = await repository.create(createData)

      expect(result.emailEncrypted).toBe('sealed-blob-base64')

      // Verify it was actually persisted
      const saved = await repository.findById(result.id)
      expect(saved?.emailEncrypted).toBe('sealed-blob-base64')
    })

    it('should store a provided emailEncrypted as-is without collapsing falsy strings', async () => {
      // Mirrors update(): only null/undefined become NULL, so an empty string
      // surfaces an upstream sealing bug instead of being silently dropped.
      const result = await repository.create({
        username: `newuser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: null,
        emailHash: null,
        emailEncrypted: '',
      })

      expect(result.emailEncrypted).toBe('')

      const saved = await repository.findById(result.id)
      expect(saved?.emailEncrypted).toBe('')
    })
  })

  describe('update', () => {
    let existingUserId: string

    beforeEach(async () => {
      // Create a user to update in each test
      const user = await repository.create({
        username: `updateuser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'original_password',
        emailHash: 'original_email',
      })
      existingUserId = user.id
    })

    it('should update user password hash', async () => {
      const updateData = {
        passwordHash: 'new_hashed_password',
      }

      const result = await repository.update(existingUserId, updateData)

      expect(result).not.toBeNull()
      expect(result!.passwordHash).toBe('new_hashed_password')
      expect(result!.emailHash).toBe('original_email') // Should remain unchanged

      // Verify it was actually updated in database
      const updated = await repository.findById(existingUserId)
      expect(updated!.passwordHash).toBe('new_hashed_password')
    })

    it('should update user email hash', async () => {
      const updateData = {
        emailHash: 'new_hashed_email',
      }

      const result = await repository.update(existingUserId, updateData)

      expect(result!.emailHash).toBe('new_hashed_email')
      expect(result!.passwordHash).toBe('original_password') // Should remain unchanged

      // Verify it was actually updated in database
      const updated = await repository.findById(existingUserId)
      expect(updated!.emailHash).toBe('new_hashed_email')
    })

    it('should clear user email hash when null provided', async () => {
      const updateData = {
        emailHash: null,
      }

      const result = await repository.update(existingUserId, updateData)

      expect(result!.emailHash).toBeNull()

      // Verify it was actually updated in database
      const updated = await repository.findById(existingUserId)
      expect(updated!.emailHash).toBeNull()
    })

    it('should update both password and email hash', async () => {
      const updateData = {
        passwordHash: 'new_hashed_password',
        emailHash: 'new_hashed_email',
      }

      const result = await repository.update(existingUserId, updateData)

      expect(result!.passwordHash).toBe('new_hashed_password')
      expect(result!.emailHash).toBe('new_hashed_email')

      // Verify it was actually updated in database
      const updated = await repository.findById(existingUserId)
      expect(updated!.passwordHash).toBe('new_hashed_password')
      expect(updated!.emailHash).toBe('new_hashed_email')
    })

    it('should update user status', async () => {
      const result = await repository.update(existingUserId, {
        status: UserStatus.Waitlist,
      })

      expect(result!.status).toBe(UserStatus.Waitlist)

      // Verify it was actually updated in database
      const updated = await repository.findById(existingUserId)
      expect(updated!.status).toBe(UserStatus.Waitlist)
    })

    it('should update the sealed (encrypted) email', async () => {
      const result = await repository.update(existingUserId, {
        emailEncrypted: 'new-sealed-blob',
      })

      expect(result!.emailEncrypted).toBe('new-sealed-blob')

      // Verify it was actually updated in database
      const updated = await repository.findById(existingUserId)
      expect(updated!.emailEncrypted).toBe('new-sealed-blob')
    })

    it('should update only updatedAt when no fields provided', async () => {
      const originalUser = await repository.findById(existingUserId)
      const updateData = {}

      // Wait a bit to ensure updatedAt changes
      await new Promise(resolve => setTimeout(resolve, 10))

      const result = await repository.update(existingUserId, updateData)

      expect(result!.passwordHash).toBe(originalUser!.passwordHash)
      expect(result!.emailHash).toBe(originalUser!.emailHash)
      expect(result!.updatedAt.getTime()).toBeGreaterThan(
        originalUser!.updatedAt.getTime()
      )
    })

    it('should return null when user not found', async () => {
      const updateData = {
        passwordHash: 'new_hashed_password',
      }

      const result = await repository.update('nonexistent-id', updateData)

      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete user and return true when user exists', async () => {
      // Create user to delete
      const user = await repository.create({
        username: `deleteuser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'password',
        emailHash: 'delete_email_hash',
      })

      const result = await repository.delete(user.id)

      expect(result).toBe(true)

      // Verify user was actually deleted
      const deleted = await repository.findById(user.id)
      expect(deleted).toBeNull()
    })

    it('should return false when user does not exist', async () => {
      const result = await repository.delete('nonexistent-id')

      expect(result).toBe(false)
    })
  })

  describe('roles', () => {
    it('should remove a role the user holds, leaving the others', async () => {
      const { id: userId } = await insertUser(testPool)
      await repository.addRole(userId, Role.User)
      await repository.addRole(userId, Role.Admin)

      await repository.removeRole(userId, Role.Admin)

      const loaded = await repository.findById(userId)
      expect(loaded!.roles).toEqual([Role.User])
    })

    // The Users console renders a revoke button from a listing that may be a
    // few seconds stale, so two admins can revoke the same role. The second
    // one has nothing to do, and that is not an error.
    it('should treat removing a role the user lacks as a no-op', async () => {
      const { id: userId } = await insertUser(testPool)
      await repository.addRole(userId, Role.User)

      await expect(
        repository.removeRole(userId, Role.Admin)
      ).resolves.toBeUndefined()

      const loaded = await repository.findById(userId)
      expect(loaded!.roles).toEqual([Role.User])
    })

    it('should leave other users of the same role untouched', async () => {
      const { id: keeperId } = await insertUser(testPool, {
        emailHash: 'keeper_email',
      })
      const { id: loserId } = await insertUser(testPool, {
        emailHash: 'loser_email',
      })
      await repository.addRole(keeperId, Role.Admin)
      await repository.addRole(loserId, Role.Admin)

      await repository.removeRole(loserId, Role.Admin)

      expect((await repository.findById(keeperId))!.roles).toEqual([Role.Admin])
      expect((await repository.findById(loserId))!.roles).toEqual([])
    })
  })

  /**
   * How many accounts hold a role, without loading them.
   *
   * The admin console's bootstrap gate asks only whether the count is zero, so
   * the answer must not depend on being able to read the users themselves.
   */
  describe('countByRole', () => {
    it('should count nobody on an empty table', async () => {
      expect(await repository.countByRole(Role.Admin)).toBe(0)
    })

    it('should not count users who hold a different role', async () => {
      const { id: userId } = await insertUser(testPool)
      await repository.addRole(userId, Role.User)

      expect(await repository.countByRole(Role.Admin)).toBe(0)
      expect(await repository.countByRole(Role.User)).toBe(1)
    })

    it('should count every user holding the role', async () => {
      const { id: firstId } = await insertUser(testPool, {
        emailHash: 'first_email',
      })
      const { id: secondId } = await insertUser(testPool, {
        emailHash: 'second_email',
      })
      await repository.addRole(firstId, Role.Admin)
      await repository.addRole(secondId, Role.Admin)
      // A second role on one of them must not double that user's contribution.
      await repository.addRole(secondId, Role.User)

      expect(await repository.countByRole(Role.Admin)).toBe(2)
    })

    it('should drop a user from the count once the role is revoked', async () => {
      const { id: userId } = await insertUser(testPool)
      await repository.addRole(userId, Role.Admin)

      await repository.removeRole(userId, Role.Admin)

      expect(await repository.countByRole(Role.Admin)).toBe(0)
    })
  })

  describe('one account per email', () => {
    it('indexes email_hash, uniquely', async () => {
      // findByEmailHash runs on every signup and every password-reset request,
      // both of which an unauthenticated caller can drive. There is no
      // behavioural assertion for an index, so assert the schema directly.
      const [result] = await testPool.query(
        'SHOW INDEX FROM users WHERE Key_name = ?',
        ['users_email_hash_idx']
      )
      const rows = result as { Column_name: string; Non_unique: number }[]

      expect(rows.map(r => r.Column_name)).toEqual(['email_hash'])
      expect(rows[0].Non_unique).toBe(0)
    })

    // The registration flow checks for an existing email before inserting, so
    // this is the race: two signups pass that check at the same time and the
    // loser hits the constraint. It must arrive as a domain error, not as a
    // mysql2 ER_DUP_ENTRY that every caller would have to know about.
    it('reports a second account on the same email as a domain error', async () => {
      await repository.create({
        username: 'first-owner',
        passwordHash: 'hashed',
        emailHash: 'shared_email_hash',
      })

      await expect(
        repository.create({
          username: 'second-owner',
          passwordHash: 'hashed',
          emailHash: 'shared_email_hash',
        })
      ).rejects.toBeInstanceOf(UserAlreadyExistsError)
    })

    it('reports a duplicate username as the same domain error', async () => {
      await repository.create({
        username: 'taken',
        passwordHash: 'hashed',
        emailHash: 'one_email_hash',
      })

      await expect(
        repository.create({
          username: 'taken',
          passwordHash: 'hashed',
          emailHash: 'another_email_hash',
        })
      ).rejects.toBeInstanceOf(UserAlreadyExistsError)
    })

    it('reports moving an email onto an account that already has it', async () => {
      await repository.create({
        username: 'owner',
        passwordHash: 'hashed',
        emailHash: 'owned_email_hash',
      })
      const other = await repository.create({
        username: 'other',
        passwordHash: 'hashed',
        emailHash: 'other_email_hash',
      })

      await expect(
        repository.update(other.id, { emailHash: 'owned_email_hash' })
      ).rejects.toBeInstanceOf(UserAlreadyExistsError)
    })

    // A unique index in MySQL does not constrain NULLs, which is what makes it
    // usable here: email is optional, and accounts without one are not all the
    // same account.
    it('allows any number of accounts with no email', async () => {
      await repository.create({
        username: 'no-email-1',
        passwordHash: 'hashed',
        emailHash: null,
      })

      const second = await repository.create({
        username: 'no-email-2',
        passwordHash: 'hashed',
        emailHash: null,
      })

      expect(second.emailHash).toBeNull()
    })
  })

  describe('replacePasswordHash', () => {
    it('replaces the hash it was given', async () => {
      const { id } = await insertUser(testPool, { passwordHash: 'old' })

      expect(await repository.replacePasswordHash(id, 'old', 'new')).toBe(true)
      expect((await repository.findById(id))?.passwordHash).toBe('new')
    })

    it('leaves a hash that changed since it was read', async () => {
      const { id } = await insertUser(testPool, { passwordHash: 'changed' })

      expect(await repository.replacePasswordHash(id, 'old', 'new')).toBe(false)
      expect((await repository.findById(id))?.passwordHash).toBe('changed')
    })
  })

  describe('deleteStaleUnverified', () => {
    const cutoff = new Date('2026-01-08T00:00:00Z')

    it('deletes an unverified account created before the cutoff', async () => {
      const { id } = await insertUser(testPool, {
        status: 'unverified',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })

      expect(await repository.deleteStaleUnverified(id, cutoff)).toBe(true)
      expect(await repository.findById(id)).toBeNull()
    })

    it.each([
      ['a verified account', 'waitlist', '2026-01-01T00:00:00Z'],
      ['an active account', 'active', '2026-01-01T00:00:00Z'],
      ['a recent unverified account', 'unverified', '2026-01-09T00:00:00Z'],
    ] as const)('keeps %s', async (_label, status, createdAt) => {
      const { id } = await insertUser(testPool, {
        status,
        createdAt: new Date(createdAt),
      })

      expect(await repository.deleteStaleUnverified(id, cutoff)).toBe(false)
      expect(await repository.findById(id)).not.toBeNull()
    })
  })

  describe('a change that ends what was issued to the user', () => {
    const later = () => new Date(Date.now() + 60 * 60 * 1000)
    const pause = () => new Promise(resolve => setTimeout(resolve, 200))
    const holdToken = 'SELECT id FROM oauth_tokens WHERE id = ? FOR UPDATE'
    const holdUser = 'SELECT id FROM users WHERE id = ? FOR UPDATE'

    async function seed(userId: string) {
      const sessions = new DrizzleSessionRepository(testDb)
      const tokens = new DrizzleOAuthTokenRepository(testDb)
      const client = await new DrizzleOAuthClientRepository(testDb).create({
        clientId: `client-${crypto.randomUUID()}`,
        clientName: 'test',
        redirectUris: ['https://example.test/cb'],
        grantTypes: ['authorization_code', 'refresh_token'],
        tokenEndpointAuthMethod: 'none',
        registrationType: 'dcr',
      })
      const codes = new DrizzleOAuthAuthorizationCodeRepository(testDb)
      const makeSession = () =>
        sessions.create({ id: crypto.randomUUID(), userId, expiresAt: later() })
      const makeToken = (kind: 'access' | 'refresh') =>
        tokens.create({
          tokenHash: crypto.randomUUID().replace(/-/g, '').repeat(2),
          kind,
          clientId: client.clientId,
          userId,
          scopes: ['pins:read'],
          resource: 'https://example.test/mcp',
          grantId: crypto.randomUUID(),
          grantedAt: new Date(),
          expiresAt: later(),
        })
      const kept = await makeSession()
      const other = await makeSession()
      const code = await codes.create(
        {
          codeHash: crypto.randomUUID().replace(/-/g, '').repeat(2),
          clientId: client.clientId,
          userId,
          redirectUri: 'https://example.test/cb',
          codeChallenge: 'challenge',
          scopes: ['pins:read'],
          resource: 'https://example.test/mcp',
          grantId: crypto.randomUUID(),
          expiresAt: later(),
        },
        other.id
      )
      if (!code) throw new Error('The seeded session is missing')
      await new DrizzleEmailChangeRepository(testDb).save({
        userId,
        tokenHash: `change-${userId}`,
        emailHash: `new-${userId}`,
        emailEncrypted: null,
        expiresAt: later(),
      })
      await repository.addRole(userId, Role.User)
      const reset = await new DrizzlePasswordResetRepository(testDb).create({
        userId,
        tokenHash: `reset-${userId}`,
        expiresAt: later(),
      })
      return {
        userId,
        resetTokenId: reset.id,
        kept,
        access: await makeToken('access'),
        refresh: await makeToken('refresh'),
      }
    }
    type Seeded = Awaited<ReturnType<typeof seed>>

    async function accountState(userId: string) {
      const count = async (table: string, live = '') => {
        const [rows] = await testPool.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ? ${live}`,
          [userId]
        )
        return Number(rows[0].n)
      }
      const user = await repository.findById(userId)
      return {
        passwordHash: user?.passwordHash,
        status: user?.status,
        roles: user?.roles,
        sessions: await count('sessions'),
        liveTokens: await count('oauth_tokens', 'AND revoked_at IS NULL'),
        unusedCodes: await count(
          'oauth_authorization_codes',
          'AND consumed_at IS NULL'
        ),
        emailChanges: await count('email_changes'),
        resetTokens: await count('password_reset_tokens'),
      }
    }

    const untouched = {
      passwordHash: 'hashed_password',
      status: UserStatus.Unverified,
      roles: [Role.User],
      sessions: 2,
      liveTokens: 2,
      unusedCodes: 1,
      emailChanges: 1,
      resetTokens: 1,
    }
    const ended = {
      sessions: 0,
      liveTokens: 0,
      unusedCodes: 0,
      emailChanges: 0,
    }

    const changes: [
      string,
      (users: DrizzleUserRepository, seeded: Seeded) => Promise<unknown>,
      Partial<typeof untouched>,
    ][] = [
      [
        'a password change',
        (users, { userId }) =>
          users.setPasswordAndRevoke(userId, { passwordHash: 'new_hash' }),
        { passwordHash: 'new_hash' },
      ],
      [
        'a password reset',
        (users, { userId, resetTokenId }) =>
          users.setPasswordAndRevoke(userId, {
            passwordHash: 'new_hash',
            status: UserStatus.Waitlist,
            resetTokenId,
          }),
        {
          passwordHash: 'new_hash',
          status: UserStatus.Waitlist,
          resetTokens: 0,
        },
      ],
      [
        'removing the User role',
        (users, { userId }) => users.removeRoleAndRevoke(userId, Role.User),
        { roles: [] },
      ],
    ]

    beforeEach(async () => {
      await testPool.query('DELETE FROM oauth_authorization_codes')
      await testPool.query('DELETE FROM oauth_tokens')
      await testPool.query('DELETE FROM oauth_clients')
    })

    describe.each(changes)('%s', (_name, change, changed) => {
      it('makes the change and ends every session, token, unused code and pending email change', async () => {
        const seeded = await seed((await insertUser(testPool)).id)

        await change(repository, seeded)

        expect(await accountState(seeded.userId)).toEqual({
          ...untouched,
          ...ended,
          ...changed,
        })
      })

      it('runs again when it loses a deadlock', async () => {
        const seeded = await seed((await insertUser(testPool)).id)
        const rival = await heavyTransaction(testPool)
        await rival.query(holdToken, [seeded.refresh.id])

        const changing = change(repository, seeded)
        await pause()
        await rival.query(holdUser, [seeded.userId])
        await pause()
        await rival.rollback()
        await changing

        expect(await accountState(seeded.userId)).toEqual({
          ...untouched,
          ...ended,
          ...changed,
        })
      })

      it('throws a write conflict and changes nothing when it loses a deadlock twice, and succeeds when called again', async () => {
        const seeded = await seed((await insertUser(testPool)).id)
        const first = await heavyTransaction(testPool)
        const second = await heavyTransaction(testPool)
        await first.query(holdToken, [seeded.refresh.id])

        const changing = change(repository, seeded).catch(
          (error: unknown) => error
        )
        await pause()
        await first.query(holdUser, [seeded.userId])
        const secondHoldsToken = second.query(holdToken, [seeded.refresh.id])
        await pause()
        await first.rollback()
        await secondHoldsToken
        await pause()
        await second.query(holdUser, [seeded.userId])
        const thrown = await Promise.race([changing, pause()])
        await second.rollback()

        expect(thrown).toBeInstanceOf(WriteConflictError)
        expect(await accountState(seeded.userId)).toEqual(untouched)
        await change(repository, seeded)
        expect(await accountState(seeded.userId)).toEqual({
          ...untouched,
          ...ended,
          ...changed,
        })
      })

      it('throws a write conflict and changes nothing when its lock wait times out, and succeeds when called again', async () => {
        const seeded = await seed((await insertUser(testPool)).id)
        const rival = await transactionHolding(testPool, holdToken, [
          seeded.refresh.id,
        ])
        const impatient = new DrizzleUserRepository(
          await impatientDatabase(TEST_DATABASE_URL)
        )

        const thrown: unknown = await change(impatient, seeded).catch(
          (error: unknown) => error
        )
        await rival.rollback()

        expect(thrown).toBeInstanceOf(WriteConflictError)
        expect(await accountState(seeded.userId)).toEqual(untouched)
        await change(repository, seeded)
        expect(await accountState(seeded.userId)).toEqual({
          ...untouched,
          ...ended,
          ...changed,
        })
      })

      it("leaves another user's account as it was", async () => {
        const seeded = await seed((await insertUser(testPool)).id)
        const bystander = await seed(
          (await insertUser(testPool, { emailHash: 'bystander_email' })).id
        )

        await change(repository, seeded)

        expect(await accountState(bystander.userId)).toEqual(untouched)
      })
    })

    describe('setPasswordAndRevoke', () => {
      it('keeps the one session it is told to keep', async () => {
        const { userId, kept } = await seed((await insertUser(testPool)).id)

        await repository.setPasswordAndRevoke(userId, {
          passwordHash: 'new_hash',
          keepSessionId: kept.id,
        })

        expect(
          (await new DrizzleSessionRepository(testDb).findByUserId(userId)).map(
            session => session.id
          )
        ).toEqual([kept.id])
        expect(await accountState(userId)).toMatchObject({ liveTokens: 0 })
      })

      it('leaves the status alone unless it is given one', async () => {
        const { userId } = await seed(
          (await insertUser(testPool, { status: 'active' })).id
        )

        expect(
          await repository.setPasswordAndRevoke(userId, {
            passwordHash: 'new_hash',
          })
        ).toBe(true)

        expect(await accountState(userId)).toMatchObject({
          passwordHash: 'new_hash',
          status: UserStatus.Active,
        })
      })

      it('resolves false for a user that is gone', async () => {
        expect(
          await repository.setPasswordAndRevoke(crypto.randomUUID(), {
            passwordHash: 'new_hash',
          })
        ).toBe(false)
      })

      it('lets exactly one of two concurrent resets spend a reset token', async () => {
        const { userId, resetTokenId } = await seed(
          (await insertUser(testPool)).id
        )

        const results = await Promise.all(
          ['first_hash', 'second_hash'].map(passwordHash =>
            repository.setPasswordAndRevoke(userId, {
              passwordHash,
              resetTokenId,
            })
          )
        )

        expect(results.filter(Boolean)).toHaveLength(1)
        expect(await accountState(userId)).toMatchObject({
          passwordHash: results[0] ? 'first_hash' : 'second_hash',
          resetTokens: 0,
        })
      })

      it('changes nothing for a reset token that has expired', async () => {
        const { userId, resetTokenId } = await seed(
          (await insertUser(testPool)).id
        )
        await testPool.query(
          'UPDATE password_reset_tokens SET expires_at = ? WHERE id = ?',
          [new Date(Date.now() - 1000), resetTokenId]
        )

        expect(
          await repository.setPasswordAndRevoke(userId, {
            passwordHash: 'new_hash',
            resetTokenId,
          })
        ).toBe(false)

        expect(await accountState(userId)).toEqual(untouched)
      })

      it("spends the user's other reset tokens with the one it was given", async () => {
        const { userId, resetTokenId } = await seed(
          (await insertUser(testPool)).id
        )
        await new DrizzlePasswordResetRepository(testDb).create({
          userId,
          tokenHash: 'an-earlier-link',
          expiresAt: later(),
        })

        await repository.setPasswordAndRevoke(userId, {
          passwordHash: 'new_hash',
          resetTokenId,
        })

        expect(await accountState(userId)).toMatchObject({ resetTokens: 0 })
      })
    })
  })
})
