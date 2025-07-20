import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { DrizzleUserRepository } from './user-repository.js'
import { db } from '../client.js'

describe('DrizzleUserRepository - Integration Tests', () => {
  let testDb: typeof db
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

    // Import the schema the same way as the production client
    const schema = await import('../schema/index.js')
    testDb = drizzle(testPool, { schema }) as typeof db

    // Create test database schema
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `)
  })

  afterAll(async () => {
    // Clean up test database
    await testPool.query('DROP TABLE IF EXISTS users')
    await testPool.end()
  })

  beforeEach(async () => {
    // Clear all data before each test
    await testPool.query('DELETE FROM users')

    // Create repository with test database
    repository = new DrizzleUserRepository(testDb)
  })

  describe('findById', () => {
    it('should find user by id', async () => {
      // Insert test data directly
      await testPool.query(`
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ('test-id-123', 'testuser', 'hashed_password', 'hashed_email', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `)

      const result = await repository.findById('test-id-123')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('test-id-123')
      expect(result!.username).toBe('testuser')
      expect(result!.passwordHash).toBe('hashed_password')
      expect(result!.emailHash).toBe('hashed_email')
    })

    it('should return null when user not found', async () => {
      const result = await repository.findById('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('findByEmailHash', () => {
    it('should find user by email hash', async () => {
      await testPool.query(`
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ('test-id-123', 'testuser', 'hashed_password', 'specific_email_hash', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `)

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
      await testPool.query(`
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ('test-id-123', 'specific_username', 'hashed_password', 'hashed_email', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `)

      const result = await repository.findByUsername('specific_username')

      expect(result).not.toBeNull()
      expect(result!.username).toBe('specific_username')
    })

    it('should return null when user not found', async () => {
      const result = await repository.findByUsername('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should return all users', async () => {
      await testPool.query(`
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at) VALUES
        ('id-1', 'user1', 'hash1', 'email1', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ('id-2', 'user2', 'hash2', 'email2', '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z')
      `)

      const result = await repository.findAll()

      expect(result).toHaveLength(2)
      expect(result.find(u => u.username === 'user1')).toBeDefined()
      expect(result.find(u => u.username === 'user2')).toBeDefined()
    })

    it('should return empty array when no users exist', async () => {
      const result = await repository.findAll()
      expect(result).toEqual([])
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Set up test data for pagination tests
      await testPool.query(`
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at) VALUES
        ('id-1', 'user1', 'hash1', 'email1', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ('id-2', 'user2', 'hash2', 'email2', '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z'),
        ('id-3', 'user3', 'hash3', 'email3', '2023-01-03T00:00:00Z', '2023-01-03T00:00:00Z')
      `)
    })

    it('should return users with limit', async () => {
      const result = await repository.list(2)

      expect(result).toHaveLength(2)
    })

    it('should return users with offset', async () => {
      const result = await repository.list(undefined, 1)

      expect(result).toHaveLength(2)
    })

    it('should return users with both limit and offset', async () => {
      const result = await repository.list(1, 1)

      expect(result).toHaveLength(1)
    })

    it('should return all users when no limit or offset provided', async () => {
      const result = await repository.list()

      expect(result).toHaveLength(3)
    })
  })

  describe('create', () => {
    it('should create user with username and password hash', async () => {
      const createData = {
        username: 'newuser',
        passwordHash: 'already_hashed_password',
      }

      const result = await repository.create(createData)

      expect(result.username).toBe('newuser')
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
        username: 'newuser',
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
        username: 'newuser',
        passwordHash: 'already_hashed_password',
        emailHash: undefined,
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
        username: 'updateuser',
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
        username: 'deleteuser',
        passwordHash: 'password',
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
