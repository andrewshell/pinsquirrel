import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Pool } from 'pg'
import { DrizzleSessionRepository } from './session.js'
import type { CreateSessionData } from '@pinsquirrel/domain'

describe('DrizzleSessionRepository - Integration Tests', () => {
  let testDb: PostgresJsDatabase<Record<string, unknown>>
  let testPool: Pool
  let repository: DrizzleSessionRepository

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
    const { sessions } = await import('../schema/sessions.js')

    const schema = {
      users,
      pins,
      tags,
      pinsTags,
      passwordResetTokens,
      sessions,
    }

    testDb = drizzle(testPool, { schema })
  })

  afterAll(async () => {
    await testPool.end()
  })

  beforeEach(async () => {
    // Create repository with test database
    repository = new DrizzleSessionRepository(testDb)

    // Clean up any existing test data (respecting foreign key constraints)
    await testPool.query('DELETE FROM pins_tags')
    await testPool.query('DELETE FROM pins')
    await testPool.query('DELETE FROM password_reset_tokens')
    await testPool.query('DELETE FROM sessions')
    await testPool.query('DELETE FROM tags')
    await testPool.query('DELETE FROM users')
  })

  describe('create', () => {
    it('should create a session', async () => {
      // First create a test user
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const sessionData: CreateSessionData = {
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      }

      const result = await repository.create(sessionData)

      expect(result).toMatchObject({
        userId,
        data: null,
      })
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it('should create a session with data', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const sessionData: CreateSessionData = {
        userId,
        data: { flash: { success: 'Welcome!' }, theme: 'dark' },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }

      const result = await repository.create(sessionData)

      expect(result.data).toEqual({
        flash: { success: 'Welcome!' },
        theme: 'dark',
      })
    })

    it('should throw error when creating session for non-existent user', async () => {
      const sessionData: CreateSessionData = {
        userId: 'non-existent-user',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }

      await expect(repository.create(sessionData)).rejects.toThrow()
    })
  })

  describe('findById', () => {
    it('should find session by id', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const sessionId = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await testPool.query(
        `
        INSERT INTO sessions (id, user_id, data, expires_at)
        VALUES ($1, $2, $3, $4)
      `,
        [sessionId, userId, null, expiresAt]
      )

      const result = await repository.findById(sessionId)

      expect(result).toMatchObject({
        id: sessionId,
        userId,
        data: null,
      })
      expect(result?.expiresAt).toBeInstanceOf(Date)
    })

    it('should return null for non-existent session', async () => {
      const result = await repository.findById('non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('findByUserId', () => {
    it('should find all sessions for a user', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      // Create multiple sessions for the user
      await repository.create({
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      await repository.create({
        userId,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      })

      const result = await repository.findByUserId(userId)

      expect(result).toHaveLength(2)
    })

    it('should return empty array for user with no sessions', async () => {
      const result = await repository.findByUserId('non-existent-user')
      expect(result).toEqual([])
    })
  })

  describe('update', () => {
    it('should update session data', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const session = await repository.create({
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      const updatedSession = await repository.update(session.id, {
        data: { flash: { error: 'Invalid credentials' } },
      })

      expect(updatedSession?.data).toEqual({
        flash: { error: 'Invalid credentials' },
      })
    })

    it('should update session expiresAt', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const session = await repository.create({
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      const newExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)
      const updatedSession = await repository.update(session.id, {
        expiresAt: newExpiresAt,
      })

      expect(updatedSession?.expiresAt.getTime()).toBe(newExpiresAt.getTime())
    })

    it('should return null for non-existent session', async () => {
      const result = await repository.update('non-existent-id', {
        data: { foo: 'bar' },
      })
      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete a specific session by id', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const session = await repository.create({
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      const deleteResult = await repository.delete(session.id)
      expect(deleteResult).toBe(true)

      const findResult = await repository.findById(session.id)
      expect(findResult).toBeNull()
    })

    it('should return false when deleting non-existent session', async () => {
      const result = await repository.delete('non-existent-id')
      expect(result).toBe(false)
    })
  })

  describe('deleteByUserId', () => {
    it('should delete all sessions for a user', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      // Create multiple sessions
      await repository.create({
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      await repository.create({
        userId,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      })

      const result = await repository.deleteByUserId(userId)
      expect(result).toBe(true)

      const remainingSessions = await repository.findByUserId(userId)
      expect(remainingSessions).toHaveLength(0)
    })

    it('should return false for user with no sessions', async () => {
      const result = await repository.deleteByUserId('non-existent-user')
      expect(result).toBe(false)
    })
  })

  describe('isValidSession', () => {
    it('should return true for valid non-expired session', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const session = await repository.create({
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours future
      })

      const result = await repository.isValidSession(session.id)
      expect(result).toBe(true)
    })

    it('should return false for expired session', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const session = await repository.create({
        userId,
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute past
      })

      const result = await repository.isValidSession(session.id)
      expect(result).toBe(false)
    })

    it('should return false for non-existent session', async () => {
      const result = await repository.isValidSession('non-existent-id')
      expect(result).toBe(false)
    })
  })

  describe('deleteExpiredSessions', () => {
    it('should delete only expired sessions', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      // Create expired session
      const expiredSession = await repository.create({
        userId,
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute past
      })

      // Create valid session
      const validSession = await repository.create({
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours future
      })

      const deletedCount = await repository.deleteExpiredSessions()
      expect(deletedCount).toBe(1)

      // Valid session should still exist
      const foundValidSession = await repository.findById(validSession.id)
      expect(foundValidSession).not.toBeNull()

      // Expired session should be gone
      const foundExpiredSession = await repository.findById(expiredSession.id)
      expect(foundExpiredSession).toBeNull()
    })

    it('should return 0 when no expired sessions exist', async () => {
      const deletedCount = await repository.deleteExpiredSessions()
      expect(deletedCount).toBe(0)
    })
  })

  describe('findAll', () => {
    it('should find all sessions', async () => {
      const userId1 = crypto.randomUUID()
      const username1 = `testuser-${crypto.randomUUID().slice(0, 8)}`
      const userId2 = crypto.randomUUID()
      const username2 = `testuser-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId1, username1]
      )
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId2, username2]
      )

      await repository.create({
        userId: userId1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      await repository.create({
        userId: userId2,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      const result = await repository.findAll()
      expect(result).toHaveLength(2)
    })

    it('should return empty array when no sessions exist', async () => {
      const result = await repository.findAll()
      expect(result).toEqual([])
    })
  })
})
