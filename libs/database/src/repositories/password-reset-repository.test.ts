import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { DrizzlePasswordResetRepository } from './password-reset-repository.js'
import { db } from '../client.js'
import type { CreatePasswordResetTokenData } from '@pinsquirrel/domain'

describe('DrizzlePasswordResetRepository - Integration Tests', () => {
  let testDb: typeof db
  let testPool: Pool
  let repository: DrizzlePasswordResetRepository

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel_test'

  beforeAll(async () => {
    // Create test database connection
    testPool = new Pool({
      connectionString: TEST_DATABASE_URL,
    })

    // Import the schema and create test database connection
    const schema = await import('../schema/index.js')
    testDb = drizzle(testPool, { schema }) as typeof db
  })

  afterAll(async () => {
    await testPool.end()
  })

  beforeEach(async () => {
    // Create repository with test database
    repository = new DrizzlePasswordResetRepository(testDb)

    // Clean up any existing test data (respecting foreign key constraints)
    await testPool.query('DELETE FROM pins_tags')
    await testPool.query('DELETE FROM pins')
    await testPool.query('DELETE FROM password_reset_tokens')
    await testPool.query('DELETE FROM tags')
    await testPool.query('DELETE FROM users')
  })

  describe('create', () => {
    it('should create a password reset token', async () => {
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

      const tokenData: CreatePasswordResetTokenData = {
        userId,
        tokenHash: 'hashed_token_123',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      }

      const result = await repository.create(tokenData)

      expect(result).toMatchObject({
        userId,
        tokenHash: 'hashed_token_123',
        expiresAt: tokenData.expiresAt,
      })
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should throw error when creating token for non-existent user', async () => {
      const tokenData: CreatePasswordResetTokenData = {
        userId: 'non-existent-user',
        tokenHash: 'hashed_token_123',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }

      await expect(repository.create(tokenData)).rejects.toThrow()
    })
  })

  describe('findById', () => {
    it('should find password reset token by id', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      // Create test user
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      // Create token directly in database
      const tokenId = crypto.randomUUID()
      const tokenHash = 'hashed_token_123'
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

      await testPool.query(
        `
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
      `,
        [tokenId, userId, tokenHash, expiresAt]
      )

      const result = await repository.findById(tokenId)

      expect(result).toMatchObject({
        id: tokenId,
        userId,
        tokenHash,
      })
      expect(result?.expiresAt).toBeInstanceOf(Date)
      // Allow for timezone differences (up to 24 hours)
      expect(
        Math.abs((result?.expiresAt.getTime() || 0) - expiresAt.getTime())
      ).toBeLessThan(86400000)
    })

    it('should return null for non-existent token', async () => {
      const result = await repository.findById('non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('findByTokenHash', () => {
    it('should find password reset token by token hash', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      // Create test user
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const tokenData: CreatePasswordResetTokenData = {
        userId,
        tokenHash: 'unique_hashed_token_456',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }

      const createdToken = await repository.create(tokenData)
      const result = await repository.findByTokenHash('unique_hashed_token_456')

      expect(result).toMatchObject({
        id: createdToken.id,
        userId,
        tokenHash: 'unique_hashed_token_456',
      })
    })

    it('should return null for non-existent token hash', async () => {
      const result = await repository.findByTokenHash('non-existent-hash')
      expect(result).toBeNull()
    })
  })

  describe('findByUserId', () => {
    it('should find all password reset tokens for a user', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      // Create test user
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      // Create multiple tokens for the user
      const token1Data: CreatePasswordResetTokenData = {
        userId,
        tokenHash: 'token_hash_1',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }

      const token2Data: CreatePasswordResetTokenData = {
        userId,
        tokenHash: 'token_hash_2',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      await repository.create(token1Data)
      await repository.create(token2Data)

      const result = await repository.findByUserId(userId)

      expect(result).toHaveLength(2)
      expect(result.map(t => t.tokenHash)).toContain('token_hash_1')
      expect(result.map(t => t.tokenHash)).toContain('token_hash_2')
    })

    it('should return empty array for user with no tokens', async () => {
      const result = await repository.findByUserId('non-existent-user')
      expect(result).toEqual([])
    })
  })

  describe('deleteByUserId', () => {
    it('should delete all tokens for a user', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      // Create test user
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      // Create multiple tokens
      await repository.create({
        userId,
        tokenHash: 'token_hash_1',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      })
      await repository.create({
        userId,
        tokenHash: 'token_hash_2',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      })

      const result = await repository.deleteByUserId(userId)
      expect(result).toBe(true)

      const remainingTokens = await repository.findByUserId(userId)
      expect(remainingTokens).toHaveLength(0)
    })

    it('should return false for user with no tokens', async () => {
      const result = await repository.deleteByUserId('non-existent-user')
      expect(result).toBe(false)
    })
  })

  describe('isValidToken', () => {
    it('should return true for valid non-expired token', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      // Create test user
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const tokenData: CreatePasswordResetTokenData = {
        userId,
        tokenHash: 'valid_token_hash',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes future
      }

      await repository.create(tokenData)
      const result = await repository.isValidToken('valid_token_hash')

      expect(result).toBe(true)
    })

    it('should return false for expired token', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      // Create test user
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const tokenData: CreatePasswordResetTokenData = {
        userId,
        tokenHash: 'expired_token_hash',
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute past
      }

      await repository.create(tokenData)
      const result = await repository.isValidToken('expired_token_hash')

      expect(result).toBe(false)
    })

    it('should return false for non-existent token', async () => {
      const result = await repository.isValidToken('non_existent_token')
      expect(result).toBe(false)
    })
  })

  describe('deleteExpiredTokens', () => {
    it('should delete only expired tokens', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      // Create test user
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      // Create expired token
      await repository.create({
        userId,
        tokenHash: 'expired_token',
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute past
      })

      // Create valid token
      await repository.create({
        userId,
        tokenHash: 'valid_token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes future
      })

      const deletedCount = await repository.deleteExpiredTokens()
      expect(deletedCount).toBe(1)

      // Valid token should still exist
      const validToken = await repository.findByTokenHash('valid_token')
      expect(validToken).not.toBeNull()

      // Expired token should be gone
      const expiredToken = await repository.findByTokenHash('expired_token')
      expect(expiredToken).toBeNull()
    })

    it('should return 0 when no expired tokens exist', async () => {
      const deletedCount = await repository.deleteExpiredTokens()
      expect(deletedCount).toBe(0)
    })
  })

  describe('delete', () => {
    it('should delete a specific token by id', async () => {
      const userId = crypto.randomUUID()
      const username = `testuser-${crypto.randomUUID().slice(0, 8)}`

      // Create test user
      await testPool.query(
        `
        INSERT INTO users (id, username, password_hash, email_hash, created_at, updated_at)
        VALUES ($1, $2, 'hashed_password', 'hashed_email', NOW(), NOW())
      `,
        [userId, username]
      )

      const tokenData: CreatePasswordResetTokenData = {
        userId,
        tokenHash: 'token_to_delete',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }

      const createdToken = await repository.create(tokenData)
      const deleteResult = await repository.delete(createdToken.id)

      expect(deleteResult).toBe(true)

      const findResult = await repository.findById(createdToken.id)
      expect(findResult).toBeNull()
    })

    it('should return false when deleting non-existent token', async () => {
      const result = await repository.delete('non-existent-id')
      expect(result).toBe(false)
    })
  })
})
