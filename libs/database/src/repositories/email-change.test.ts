import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { Pool, RowDataPacket } from 'mysql2/promise'
import { WriteConflictError } from '@pinsquirrel/domain'
import {
  heavyTransaction,
  impatientDatabase,
  insertUser,
  transactionHolding,
} from '../test-fixtures.js'
import { DrizzleEmailChangeRepository } from './email-change.js'
import { DrizzlePasswordResetRepository } from './password-reset.js'

describe('DrizzleEmailChangeRepository - Integration Tests', () => {
  let testPool: Pool
  let testDb: MySql2Database
  let repository: DrizzleEmailChangeRepository

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel_test'

  const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000)
  const pause = () => new Promise(resolve => setTimeout(resolve, 200))
  const holdChange =
    'SELECT id FROM email_changes WHERE token_hash = ? FOR UPDATE'
  const holdUser = 'SELECT id FROM users WHERE id = ? FOR UPDATE'

  beforeAll(() => {
    testPool = mysql.createPool(TEST_DATABASE_URL)
    testDb = drizzle({ client: testPool })
  })

  afterAll(async () => {
    await testPool.end()
  })

  beforeEach(async () => {
    repository = new DrizzleEmailChangeRepository(testDb)
    await testPool.query('DELETE FROM email_changes')
    await testPool.query('DELETE FROM password_reset_tokens')
    await testPool.query('DELETE FROM user_roles')
    await testPool.query('DELETE FROM users')
  })

  async function pendingChange(tokenHash = 'link') {
    const { id: userId } = await insertUser(testPool, {
      emailHash: `old-${tokenHash}`,
      emailEncrypted: 'sealed-old',
    })
    await repository.save({
      userId,
      tokenHash,
      emailHash: `new-${tokenHash}`,
      emailEncrypted: 'sealed-new',
      expiresAt: inAnHour(),
    })
    await new DrizzlePasswordResetRepository(testDb).create({
      userId,
      tokenHash: `reset-${tokenHash}`,
      expiresAt: inAnHour(),
    })
    return userId
  }

  async function accountState(userId: string) {
    const [[user]] = await testPool.query<RowDataPacket[]>(
      'SELECT email_hash, email_encrypted FROM users WHERE id = ?',
      [userId]
    )
    const count = async (table: string) => {
      const [rows] = await testPool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`,
        [userId]
      )
      return Number(rows[0].n)
    }
    return {
      emailHash: user?.email_hash as unknown,
      emailEncrypted: user?.email_encrypted as unknown,
      emailChanges: await count('email_changes'),
      resetTokens: await count('password_reset_tokens'),
    }
  }

  const untouched = {
    emailHash: 'old-link',
    emailEncrypted: 'sealed-old',
    emailChanges: 1,
    resetTokens: 1,
  }
  const confirmed = {
    emailHash: 'new-link',
    emailEncrypted: 'sealed-new',
    emailChanges: 0,
    resetTokens: 0,
  }

  describe('confirm', () => {
    it("writes the new address, spends the link and the user's reset tokens, and works once", async () => {
      const userId = await pendingChange()

      expect(await repository.confirm('link')).toBe(true)
      expect(await accountState(userId)).toEqual(confirmed)
      expect(await repository.confirm('link')).toBe(false)
    })

    it('honours only the latest change the user asked for', async () => {
      const { id: userId } = await insertUser(testPool)
      const change = {
        userId,
        emailHash: 'h',
        emailEncrypted: null,
        expiresAt: inAnHour(),
      }
      await repository.save({ ...change, tokenHash: 'first' })
      await repository.save({ ...change, tokenHash: 'second' })

      expect(await repository.confirm('first')).toBe(false)
      expect(await repository.confirm('second')).toBe(true)
    })

    it('changes nothing for an expired link', async () => {
      const userId = await pendingChange()
      await testPool.query('UPDATE email_changes SET expires_at = ?', [
        new Date(Date.now() - 1000),
      ])

      expect(await repository.confirm('link')).toBe(false)
      expect(await accountState(userId)).toMatchObject({
        emailHash: 'old-link',
        resetTokens: 1,
      })
    })

    it('changes nothing when another account has the address', async () => {
      const userId = await pendingChange()
      const { id: holderId } = await insertUser(testPool, {
        emailHash: 'new-link',
      })

      expect(await repository.confirm('link')).toBe(false)
      expect(await accountState(userId)).toMatchObject({
        emailHash: 'old-link',
        emailEncrypted: 'sealed-old',
        resetTokens: 1,
      })
      expect(await accountState(holderId)).toMatchObject({
        emailHash: 'new-link',
      })
    })

    it('lets exactly one of two concurrent confirmations through', async () => {
      const userId = await pendingChange()

      const results = await Promise.all([
        repository.confirm('link'),
        repository.confirm('link'),
      ])

      expect(results.filter(Boolean)).toHaveLength(1)
      expect(await accountState(userId)).toEqual(confirmed)
    })

    it('goes with its user', async () => {
      const userId = await pendingChange()

      await testPool.query('DELETE FROM users WHERE id = ?', [userId])

      expect(await repository.confirm('link')).toBe(false)
      const [rows] = await testPool.query('SELECT id FROM email_changes')
      expect(rows).toEqual([])
    })

    it('runs again when it loses a deadlock', async () => {
      const userId = await pendingChange()
      const rival = await heavyTransaction(testPool)
      await rival.query(holdChange, ['link'])

      const confirming = repository.confirm('link')
      await pause()
      await rival.query(holdUser, [userId])
      await pause()
      await rival.rollback()

      expect(await confirming).toBe(true)
      expect(await accountState(userId)).toEqual(confirmed)
    })

    it('throws a write conflict and changes nothing when it loses a deadlock twice, and the same link works after', async () => {
      const userId = await pendingChange()
      const first = await heavyTransaction(testPool)
      const second = await heavyTransaction(testPool)
      await first.query(holdChange, ['link'])

      const confirming = repository
        .confirm('link')
        .catch((error: unknown) => error)
      await pause()
      await first.query(holdUser, [userId])
      const secondHoldsChange = second.query(holdChange, ['link'])
      await pause()
      await first.rollback()
      await secondHoldsChange
      await pause()
      await second.query(holdUser, [userId])
      const thrown = await Promise.race([confirming, pause()])
      await second.rollback()

      expect(thrown).toBeInstanceOf(WriteConflictError)
      expect(await accountState(userId)).toEqual(untouched)
      expect(await repository.confirm('link')).toBe(true)
      expect(await accountState(userId)).toEqual(confirmed)
    })

    it('throws a write conflict and changes nothing when its lock wait times out, and the same link works after', async () => {
      const userId = await pendingChange()
      const rival = await transactionHolding(testPool, holdUser, [userId])
      const impatient = new DrizzleEmailChangeRepository(
        await impatientDatabase(TEST_DATABASE_URL)
      )

      const thrown: unknown = await impatient
        .confirm('link')
        .catch((error: unknown) => error)
      await rival.rollback()

      expect(thrown).toBeInstanceOf(WriteConflictError)
      expect(await accountState(userId)).toEqual(untouched)
      expect(await repository.confirm('link')).toBe(true)
      expect(await accountState(userId)).toEqual(confirmed)
    })

    it("leaves another user's pending change and reset tokens alone", async () => {
      await pendingChange()
      const bystanderId = await pendingChange('other')

      await repository.confirm('link')

      expect(await accountState(bystanderId)).toEqual({
        emailHash: 'old-other',
        emailEncrypted: 'sealed-old',
        emailChanges: 1,
        resetTokens: 1,
      })
    })
  })
})
