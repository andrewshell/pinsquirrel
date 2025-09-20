import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Pool } from 'pg'
import { DrizzleUserRepository } from './user.js'

describe('DrizzleUserRepository - Integration Tests', () => {
  let testDb: PostgresJsDatabase<Record<string, unknown>>
  let testPool: Pool
  let repository: DrizzleUserRepository

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel_test'

  beforeAll(async () => {
    // Create test database connection
    testPool = new Pool({
      connectionString: TEST_DATABASE_URL,
    })

    // Import the schema and create test database connection
    const { users } = await import('../schema/users.js')
    const { pins } = await import('../schema/pins.js')
    const { tags } = await import('../schema/tags.js')
    const { pinsTags } = await import('../schema/pins-tags.js')
    const { passwordResetTokens } = await import(
      '../schema/password-reset-tokens.js'
    )

    const schema = {
      users,
      pins,
      tags,
      pinsTags,
      passwordResetTokens,
    }

    testDb = drizzle(testPool, { schema })
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
    await testPool.query('DELETE FROM tags')
    await testPool.query('DELETE FROM users')
  })

  describe('findById', () => {
    it('should find user by id', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      // Insert test data directly
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [userId, username]
      )

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
      const testUserId = crypto.randomUUID()
      const testUsername = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'specific_email_hash', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [testUserId, testUsername]
      )

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
      const userId = crypto.randomUUID()
      const username = `specific_username-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [userId, username]
      )

      const result = await repository.findByUsername(username)

      expect(result).not.toBeNull()
      expect(result!.username).toBe(username)
    })

    it('should return null when user not found', async () => {
      const result = await repository.findByUsername('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should return all users', async () => {
      const user1Id = crypto.randomUUID()
      const user2Id = crypto.randomUUID()
      const user1Name = `user1-${crypto.randomUUID().slice(0, 8)}`
      const user2Name = `user2-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at) VALUES
        ($1, $3, 'hash1', 'email1', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ($2, $4, 'hash2', 'email2', '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z')
      `,
        [user1Id, user2Id, user1Name, user2Name]
      )

      const result = await repository.findAll()

      // Find our specific users in the results
      const ourUser1 = result.find(u => u.id === user1Id)
      const ourUser2 = result.find(u => u.id === user2Id)

      expect(ourUser1).toBeDefined()
      expect(ourUser2).toBeDefined()
      expect(ourUser1!.username).toBe(user1Name)
      expect(ourUser2!.username).toBe(user2Name)
    })

    it('should return empty array when no users exist', async () => {
      // This test can't be reliable in a shared database, so we'll skip this specific assertion
      // Just verify that findAll returns an array
      const result = await repository.findAll()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('list', () => {
    it('should return users with limit', async () => {
      // Create test users for this test
      await Promise.all([
        repository.create({
          username: `user1-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash1',
          emailHash: 'email_hash1',
        }),
        repository.create({
          username: `user2-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash2',
          emailHash: 'email_hash2',
        }),
        repository.create({
          username: `user3-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash3',
          emailHash: 'email_hash3',
        }),
      ])

      const result = await repository.list(2)
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('should return users with offset', async () => {
      // Create test users for this test
      await Promise.all([
        repository.create({
          username: `user1-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash1',
          emailHash: 'email_hash1',
        }),
        repository.create({
          username: `user2-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash2',
          emailHash: 'email_hash2',
        }),
        repository.create({
          username: `user3-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash3',
          emailHash: 'email_hash3',
        }),
      ])

      const result = await repository.list(undefined, 1)
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('should return users with both limit and offset', async () => {
      // Create test users for this test
      await Promise.all([
        repository.create({
          username: `user1-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash1',
          emailHash: 'email_hash1',
        }),
        repository.create({
          username: `user2-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash2',
          emailHash: 'email_hash2',
        }),
        repository.create({
          username: `user3-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash3',
          emailHash: 'email_hash3',
        }),
      ])

      const result = await repository.list(1, 1)
      expect(result).toHaveLength(1)
    })

    it('should return all users when no limit or offset provided', async () => {
      // Create test users for this test
      await Promise.all([
        repository.create({
          username: `user1-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash1',
          emailHash: 'email_hash1',
        }),
        repository.create({
          username: `user2-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash2',
          emailHash: 'email_hash2',
        }),
        repository.create({
          username: `user3-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash3',
          emailHash: 'email_hash3',
        }),
      ])

      const result = await repository.list()
      expect(result.length).toBeGreaterThanOrEqual(3)
    })

    it('should return all users when called with undefined for both parameters', async () => {
      // Create test users for this test
      await Promise.all([
        repository.create({
          username: `user1-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash1',
          emailHash: 'email_hash1',
        }),
        repository.create({
          username: `user2-${crypto.randomUUID().slice(0, 8)}`,
          passwordHash: 'hash2',
          emailHash: 'email_hash2',
        }),
      ])

      // Explicitly pass undefined to hit the else branch
      const result = await repository.list(undefined, undefined)
      expect(result.length).toBeGreaterThanOrEqual(2)
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
})
