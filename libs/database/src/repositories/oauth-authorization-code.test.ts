import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import { eq } from 'drizzle-orm'
import type { CreateAuthorizationCodeData } from '@pinsquirrel/domain'
import { insertUser } from '../test-fixtures.js'
import { oauthAuthorizationCodes } from '../schema/oauth-authorization-codes.js'
import { DrizzleOAuthClientRepository } from './oauth-client.js'
import { DrizzleOAuthAuthorizationCodeRepository } from './oauth-authorization-code.js'

describe('DrizzleOAuthAuthorizationCodeRepository - Integration Tests', () => {
  let testDb: MySql2Database
  let testPool: Pool
  let repository: DrizzleOAuthAuthorizationCodeRepository
  let clients: DrizzleOAuthClientRepository
  let userId: string
  let clientId: string

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel_test'

  const code = (
    overrides: Partial<CreateAuthorizationCodeData> = {}
  ): CreateAuthorizationCodeData => ({
    codeHash: crypto.randomUUID().replace(/-/g, '').repeat(2),
    clientId,
    userId,
    redirectUri: 'https://claude.ai/api/mcp/auth_callback',
    codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    scopes: ['pins:read', 'tags:read'],
    resource: 'https://pinsquirrel.com/mcp',
    expiresAt: new Date(Date.now() + 60 * 1000),
    ...overrides,
  })

  beforeAll(() => {
    testPool = mysql.createPool(TEST_DATABASE_URL)
    testDb = drizzle({ client: testPool })
  })

  afterAll(async () => {
    await testPool.end()
  })

  beforeEach(async () => {
    repository = new DrizzleOAuthAuthorizationCodeRepository(testDb)
    clients = new DrizzleOAuthClientRepository(testDb)

    await testPool.query('DELETE FROM oauth_tokens')
    await testPool.query('DELETE FROM oauth_authorization_codes')
    await testPool.query('DELETE FROM oauth_clients')
    await testPool.query('DELETE FROM users')

    userId = (await insertUser(testPool)).id
    clientId = (
      await clients.create({
        clientId: `client-${crypto.randomUUID()}`,
        clientName: 'Test Client',
        redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
        grantTypes: ['authorization_code'],
        tokenEndpointAuthMethod: 'none',
        registrationType: 'dcr',
      })
    ).clientId
  })

  describe('create', () => {
    it('should create a code with everything the exchange has to check', async () => {
      const data = code()

      const result = await repository.create(data)

      expect(result).toMatchObject({
        codeHash: data.codeHash,
        clientId,
        userId,
        redirectUri: 'https://claude.ai/api/mcp/auth_callback',
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        scopes: ['pins:read', 'tags:read'],
        resource: 'https://pinsquirrel.com/mcp',
        consumedAt: null,
      })
      expect(result.id).toBeDefined()
      expect(result.expiresAt.getTime()).toBe(data.expiresAt.getTime())
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should reject a code for an unregistered client', async () => {
      await expect(
        repository.create(code({ clientId: 'never-registered' }))
      ).rejects.toThrow()
    })

    it('should go with the client when the client is deleted', async () => {
      const created = await repository.create(code())

      const client = await clients.findByClientId(clientId)
      await clients.delete(client!.id)

      expect(await repository.findById(created.id)).toBeNull()
    })

    it('should go with the user when the user is deleted', async () => {
      const created = await repository.create(code())

      await testPool.query('DELETE FROM users WHERE id = ?', [userId])

      expect(await repository.findById(created.id)).toBeNull()
    })
  })

  describe('findByCodeHash', () => {
    it('should find a code by its hash', async () => {
      const created = await repository.create(code())

      const result = await repository.findByCodeHash(created.codeHash)

      expect(result?.id).toBe(created.id)
      expect(result?.scopes).toEqual(['pins:read', 'tags:read'])
    })

    it('should return null for an unknown hash', async () => {
      expect(await repository.findByCodeHash('nope')).toBeNull()
    })
  })

  describe('consume', () => {
    it('should return the code and mark it spent', async () => {
      const created = await repository.create(code())

      const consumed = await repository.consume(created.codeHash)

      expect(consumed?.id).toBe(created.id)
      expect(consumed?.consumedAt).toBeInstanceOf(Date)
      expect(
        (await repository.findById(created.id))?.consumedAt
      ).toBeInstanceOf(Date)
    })

    it('should refuse a second exchange of the same code', async () => {
      const created = await repository.create(code())
      await repository.consume(created.codeHash)

      expect(await repository.consume(created.codeHash)).toBeNull()
    })

    it('should let exactly one of two concurrent exchanges win', async () => {
      // The single-use guarantee. A read-then-write would let both callers
      // see an unconsumed code and both mint tokens.
      const created = await repository.create(code())

      const results = await Promise.all([
        repository.consume(created.codeHash),
        repository.consume(created.codeHash),
      ])

      expect(results.filter(r => r !== null)).toHaveLength(1)
    })

    it('should refuse an expired code', async () => {
      const created = await repository.create(
        code({ expiresAt: new Date(Date.now() - 1000) })
      )

      expect(await repository.consume(created.codeHash)).toBeNull()
      expect((await repository.findById(created.id))?.consumedAt).toBeNull()
    })

    it('should return null for an unknown hash', async () => {
      expect(await repository.consume('nope')).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete a code', async () => {
      const created = await repository.create(code())

      expect(await repository.delete(created.id)).toBe(true)
      expect(await repository.findById(created.id)).toBeNull()
    })

    it('should return false for a non-existent code', async () => {
      expect(await repository.delete('non-existent-id')).toBe(false)
    })
  })

  describe('deleteExpiredCodes', () => {
    it('should delete expired codes, spent or not, and keep live ones', async () => {
      const expired = await repository.create(code())
      await testDb
        .update(oauthAuthorizationCodes)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(oauthAuthorizationCodes.id, expired.id))
      const live = await repository.create(code())
      await repository.consume(live.codeHash)

      const deleted = await repository.deleteExpiredCodes()

      expect(deleted).toBe(1)
      expect(await repository.findById(expired.id)).toBeNull()
      // A spent code stays until it expires, so a replay is still
      // recognisable rather than reading as an unknown code.
      expect(await repository.findById(live.id)).not.toBeNull()
    })

    it('should return 0 when nothing has expired', async () => {
      expect(await repository.deleteExpiredCodes()).toBe(0)
    })

    it('indexes expires_at, which the sweep scans on', async () => {
      const [result] = await testPool.query(
        'SHOW INDEX FROM oauth_authorization_codes WHERE Key_name = ?',
        ['oauth_authorization_codes_expires_at_idx']
      )
      const rows = result as { Column_name: string }[]

      expect(rows.map(r => r.Column_name)).toEqual(['expires_at'])
    })
  })
})
