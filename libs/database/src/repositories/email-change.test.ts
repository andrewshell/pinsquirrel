import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import { insertUser } from '../test-fixtures.js'
import { DrizzleEmailChangeRepository } from './email-change.js'

describe('DrizzleEmailChangeRepository - Integration Tests', () => {
  let testPool: Pool
  let testDb: MySql2Database
  let repository: DrizzleEmailChangeRepository

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel_test'

  const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000)

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
    await testPool.query('DELETE FROM user_roles')
    await testPool.query('DELETE FROM users')
  })

  it('returns a saved change once for its token', async () => {
    const { id: userId } = await insertUser(testPool)
    await repository.save({
      userId,
      tokenHash: 'token-1',
      emailHash: 'new-hash',
      emailEncrypted: 'sealed',
      expiresAt: inAnHour(),
    })

    expect(await repository.consume('token-1')).toMatchObject({
      userId,
      emailHash: 'new-hash',
      emailEncrypted: 'sealed',
    })
    expect(await repository.consume('token-1')).toBeNull()
  })

  it('replaces the earlier change of the same user', async () => {
    const { id: userId } = await insertUser(testPool)
    const change = {
      userId,
      emailHash: 'h',
      emailEncrypted: null,
      expiresAt: inAnHour(),
    }
    await repository.save({ ...change, tokenHash: 'first' })
    await repository.save({ ...change, tokenHash: 'second' })

    expect(await repository.consume('first')).toBeNull()
    expect(await repository.consume('second')).not.toBeNull()
  })

  it('does not return an expired change', async () => {
    const { id: userId } = await insertUser(testPool)
    await repository.save({
      userId,
      tokenHash: 'old',
      emailHash: 'h',
      emailEncrypted: null,
      expiresAt: new Date(Date.now() - 1000),
    })

    expect(await repository.consume('old')).toBeNull()
  })

  it('gives a change to only one of two concurrent consumers', async () => {
    const { id: userId } = await insertUser(testPool)
    await repository.save({
      userId,
      tokenHash: 'race',
      emailHash: 'h',
      emailEncrypted: null,
      expiresAt: inAnHour(),
    })

    const results = await Promise.all([
      repository.consume('race'),
      repository.consume('race'),
    ])

    expect(results.filter(r => r !== null)).toHaveLength(1)
  })

  it('goes with its user', async () => {
    const { id: userId } = await insertUser(testPool)
    await repository.save({
      userId,
      tokenHash: 'gone',
      emailHash: 'h',
      emailEncrypted: null,
      expiresAt: inAnHour(),
    })

    await testPool.query('DELETE FROM users WHERE id = ?', [userId])

    expect(await repository.consume('gone')).toBeNull()
    const [rows] = await testPool.query('SELECT id FROM email_changes')
    expect(rows).toEqual([])
  })
})
