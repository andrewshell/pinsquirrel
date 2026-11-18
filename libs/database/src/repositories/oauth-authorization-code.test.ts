import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import { eq } from 'drizzle-orm'
import type {
  AuthorizationCode,
  CreateAuthorizationCodeData,
  CreateOAuthTokenData,
} from '@pinsquirrel/domain'
import { Role, WriteConflictError } from '@pinsquirrel/domain'
import {
  heavyTransaction,
  impatientDatabase,
  insertUser,
  transactionHolding,
} from '../test-fixtures.js'
import { oauthAuthorizationCodes } from '../schema/oauth-authorization-codes.js'
import { DrizzleOAuthClientRepository } from './oauth-client.js'
import { DrizzleOAuthAuthorizationCodeRepository } from './oauth-authorization-code.js'
import { DrizzleOAuthTokenRepository } from './oauth-token.js'
import { DrizzleUserRepository } from './user.js'

describe('DrizzleOAuthAuthorizationCodeRepository - Integration Tests', () => {
  let testDb: MySql2Database
  let testPool: Pool
  let repository: DrizzleOAuthAuthorizationCodeRepository
  let clients: DrizzleOAuthClientRepository
  let userId: string
  let clientId: string
  let sessionId: string

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
    grantId: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 60 * 1000),
    ...overrides,
  })

  const createCode = async (data = code()): Promise<AuthorizationCode> => {
    const created = await repository.create(data, sessionId)
    if (!created)
      throw new Error('The session the code was created under is gone')
    return created
  }

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
    await testPool.query('DELETE FROM sessions')
    await testPool.query('DELETE FROM users')

    userId = (await insertUser(testPool)).id
    sessionId = crypto.randomUUID().replace(/-/g, '').repeat(2)
    await testPool.query(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
      [sessionId, userId, new Date(Date.now() + 60 * 60 * 1000)]
    )
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

      const result = await createCode(data)

      expect(result).toMatchObject({
        codeHash: data.codeHash,
        clientId,
        userId,
        redirectUri: 'https://claude.ai/api/mcp/auth_callback',
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        scopes: ['pins:read', 'tags:read'],
        resource: 'https://pinsquirrel.com/mcp',
        grantId: data.grantId,
        consumedAt: null,
      })
      expect(result.id).toBeDefined()
      expect(result.expiresAt.getTime()).toBe(data.expiresAt.getTime())
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should reject a code for an unregistered client', async () => {
      await expect(
        repository.create(code({ clientId: 'never-registered' }), sessionId)
      ).rejects.toThrow()
    })

    it('should create nothing once the session it was approved in is gone', async () => {
      await testPool.query('DELETE FROM sessions WHERE id = ?', [sessionId])
      const data = code()

      expect(await repository.create(data, sessionId)).toBeNull()
      expect(await repository.findByCodeHash(data.codeHash)).toBeNull()
    })

    it('should leave no code when the sessions are revoked between its session check and its insert', async () => {
      // Holding the client row stalls the insert's foreign key check, after
      // the session has been read.
      const stall = await testPool.getConnection()
      await stall.beginTransaction()
      await stall.query(
        'SELECT client_id FROM oauth_clients WHERE client_id = ? FOR UPDATE',
        [clientId]
      )
      const data = code()
      const creating = repository.create(data, sessionId)
      await new Promise(resolve => setTimeout(resolve, 200))
      const revoking = new DrizzleUserRepository(testDb).removeRoleAndRevoke(
        userId,
        Role.User
      )
      await new Promise(resolve => setTimeout(resolve, 200))
      await stall.commit()
      stall.release()

      await Promise.all([creating, revoking])

      expect(await repository.findByCodeHash(data.codeHash)).toBeNull()
    })

    it('should create nothing, and not fail, when the user is deleted between its session check and its insert', async () => {
      const stall = await testPool.getConnection()
      await stall.beginTransaction()
      await stall.query(
        'SELECT client_id FROM oauth_clients WHERE client_id = ? FOR UPDATE',
        [clientId]
      )
      const data = code()
      const creating = repository.create(data, sessionId)
      await new Promise(resolve => setTimeout(resolve, 200))
      const deleting = new DrizzleUserRepository(testDb).delete(userId)
      await new Promise(resolve => setTimeout(resolve, 200))
      await stall.commit()
      stall.release()

      expect(await creating).toBeNull()
      expect(await deleting).toBe(true)
      expect(await repository.findByCodeHash(data.codeHash)).toBeNull()
    })

    it('should throw a write conflict, and leave the code to create later, when it loses a deadlock twice', async () => {
      const pause = () => new Promise(resolve => setTimeout(resolve, 200))
      const holdClient =
        'SELECT client_id FROM oauth_clients WHERE client_id = ? FOR UPDATE'
      const holdSession = 'SELECT id FROM sessions WHERE id = ? FOR UPDATE'
      const first = await heavyTransaction(testPool)
      const second = await heavyTransaction(testPool)
      await first.query(holdClient, [clientId])
      const data = code()

      const creating = repository
        .create(data, sessionId)
        .catch((error: unknown) => error)
      await pause()
      await first.query(holdSession, [sessionId])
      const secondHoldsClient = second.query(holdClient, [clientId])
      await pause()
      await first.rollback()
      await secondHoldsClient
      await pause()
      await second.query(holdSession, [sessionId])
      const thrown = await Promise.race([creating, pause()])
      await second.rollback()

      expect(thrown).toBeInstanceOf(WriteConflictError)
      expect(await repository.findByCodeHash(data.codeHash)).toBeNull()
      expect(await repository.create(data, sessionId)).not.toBeNull()
    })

    it('should create nothing under a session that belongs to another user', async () => {
      const otherUserId = (
        await insertUser(testPool, { emailHash: 'other_email' })
      ).id
      const data = code({ userId: otherUserId })

      expect(await repository.create(data, sessionId)).toBeNull()
      expect(await repository.findByCodeHash(data.codeHash)).toBeNull()
    })

    it('should go with the client when the client is deleted', async () => {
      const created = await createCode()

      const client = await clients.findByClientId(clientId)
      await clients.delete(client!.id)

      expect(await repository.findById(created.id)).toBeNull()
    })

    it('should go with the user when the user is deleted', async () => {
      const created = await createCode()

      await testPool.query('DELETE FROM users WHERE id = ?', [userId])

      expect(await repository.findById(created.id)).toBeNull()
    })
  })

  describe('findByCodeHash', () => {
    it('should find a code by its hash', async () => {
      const created = await createCode()

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
      const created = await createCode()

      const consumed = await repository.consume(created.codeHash)

      expect(consumed?.id).toBe(created.id)
      expect(consumed?.consumedAt).toBeInstanceOf(Date)
      expect(
        (await repository.findById(created.id))?.consumedAt
      ).toBeInstanceOf(Date)
    })

    it('should refuse a second exchange of the same code', async () => {
      const created = await createCode()
      await repository.consume(created.codeHash)

      expect(await repository.consume(created.codeHash)).toBeNull()
    })

    it('should let exactly one of two concurrent exchanges win', async () => {
      // The single-use guarantee. A read-then-write would let both callers
      // see an unconsumed code and both mint tokens.
      const created = await createCode()

      const results = await Promise.all([
        repository.consume(created.codeHash),
        repository.consume(created.codeHash),
      ])

      expect(results.filter(r => r !== null)).toHaveLength(1)
    })

    it('should refuse an expired code', async () => {
      const created = await createCode(
        code({ expiresAt: new Date(Date.now() - 1000) })
      )

      expect(await repository.consume(created.codeHash)).toBeNull()
      expect((await repository.findById(created.id))?.consumedAt).toBeNull()
    })

    it('should return null for an unknown hash', async () => {
      expect(await repository.consume('nope')).toBeNull()
    })
  })

  describe('exchange', () => {
    const tokensFor = (
      created: AuthorizationCode
    ): [CreateOAuthTokenData, CreateOAuthTokenData] => {
      const shared = {
        clientId,
        userId,
        scopes: created.scopes,
        resource: created.resource,
        grantId: created.grantId ?? crypto.randomUUID(),
        grantedAt: created.createdAt,
        expiresAt: new Date(Date.now() + 60 * 1000),
      }
      const hash = () => crypto.randomUUID().replace(/-/g, '').repeat(2)
      return [
        { ...shared, kind: 'access', tokenHash: hash() },
        { ...shared, kind: 'refresh', tokenHash: hash() },
      ]
    }

    const stored = (data: CreateOAuthTokenData) =>
      new DrizzleOAuthTokenRepository(testDb).findByTokenHash(data.tokenHash)

    it('should spend the code and write its tokens', async () => {
      const created = await createCode()
      const [access, refresh] = tokensFor(created)

      expect(await repository.exchange(created.id, [access, refresh])).toBe(
        'exchanged'
      )

      expect(
        (await repository.findById(created.id))?.consumedAt
      ).toBeInstanceOf(Date)
      expect(await stored(access)).toMatchObject({ grantId: created.grantId })
      expect(await stored(refresh)).toMatchObject({ grantId: created.grantId })
    })

    it('should leave the code unspent when a token cannot be written', async () => {
      const created = await createCode()
      const [access, refresh] = tokensFor(created)

      await expect(
        repository.exchange(created.id, [
          access,
          { ...refresh, tokenHash: access.tokenHash },
        ])
      ).rejects.toThrow()

      expect((await repository.findById(created.id))?.consumedAt).toBeNull()
      expect(await stored(access)).toBeNull()
    })

    it('should say a spent code was spent, and write nothing', async () => {
      const created = await createCode()
      await repository.exchange(created.id, tokensFor(created))
      const again = tokensFor(created)

      expect(await repository.exchange(created.id, again)).toBe('spent')
      expect(await stored(again[0])).toBeNull()
    })

    it('should let exactly one of two concurrent exchanges win', async () => {
      const created = await createCode()

      const results = await Promise.all([
        repository.exchange(created.id, tokensFor(created)),
        repository.exchange(created.id, tokensFor(created)),
      ])

      expect(results.sort()).toEqual(['exchanged', 'spent'])
    })

    it('should say an expired code is gone', async () => {
      const created = await createCode(
        code({ expiresAt: new Date(Date.now() - 1000) })
      )

      expect(await repository.exchange(created.id, tokensFor(created))).toBe(
        'gone'
      )
      expect((await repository.findById(created.id))?.consumedAt).toBeNull()
    })

    it('should say a code the user revoked is gone, and write nothing', async () => {
      const created = await createCode()
      const pair = tokensFor(created)
      await new DrizzleUserRepository(testDb).removeRoleAndRevoke(
        userId,
        Role.User
      )

      expect(await repository.exchange(created.id, pair)).toBe('gone')
      expect(await stored(pair[0])).toBeNull()
    })

    it('should not leave live tokens when the client is revoked between the spend and the inserts', async () => {
      const created = await createCode()
      const [access, refresh] = tokensFor(created)
      // An uncommitted row with the access token's hash stalls its insert
      // before any foreign key check, after the exchange has spent the code.
      const holder = await insertUser(testPool, {
        emailHash: crypto.randomUUID(),
      })
      const stall = await testPool.getConnection()
      await stall.beginTransaction()
      await stall.query(
        `INSERT INTO oauth_tokens
           (id, token_hash, kind, client_id, user_id, scopes, resource, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          access.tokenHash,
          access.kind,
          clientId,
          holder.id,
          JSON.stringify(access.scopes),
          access.resource,
          access.expiresAt,
        ]
      )
      const exchanging = repository.exchange(created.id, [access, refresh])
      await new Promise(resolve => setTimeout(resolve, 200))
      const revoking = new DrizzleOAuthTokenRepository(
        testDb
      ).revokeByUserAndClient(userId, clientId)
      await new Promise(resolve => setTimeout(resolve, 200))
      await stall.rollback()
      stall.release()

      await Promise.all([exchanging, revoking])

      expect((await stored(access))?.revokedAt).toBeInstanceOf(Date)
      expect((await stored(refresh))?.revokedAt).toBeInstanceOf(Date)
    })

    it.each([
      ['run again when it loses a deadlock, and write its tokens', 1],
      [
        'throw a write conflict, and leave the code to exchange later, when it loses a deadlock twice',
        2,
      ],
    ])('should %s', async (_name, deadlocks) => {
      const created = await createCode()
      const [access, refresh] = tokensFor(created)
      const rival = await heavyTransaction(testPool)
      await rival.query(
        'SELECT client_id FROM oauth_clients WHERE client_id = ? FOR UPDATE',
        [clientId]
      )

      const exchanging = repository
        .exchange(created.id, [access, refresh])
        .catch((error: unknown) => error)
      await new Promise(resolve => setTimeout(resolve, 200))
      await rival.query(
        'SELECT id FROM oauth_authorization_codes WHERE id = ? FOR UPDATE',
        [created.id]
      )
      await new Promise(resolve => setTimeout(resolve, 200))
      if (deadlocks === 2) {
        await rival.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [
          userId,
        ])
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      await rival.rollback()

      if (deadlocks === 1) {
        expect(await exchanging).toBe('exchanged')
        expect(await stored(access)).not.toBeNull()
        expect(await stored(refresh)).not.toBeNull()
      } else {
        expect(await exchanging).toBeInstanceOf(WriteConflictError)
        expect((await repository.findById(created.id))?.consumedAt).toBeNull()
        expect(await stored(access)).toBeNull()
        expect(await repository.exchange(created.id, [access, refresh])).toBe(
          'exchanged'
        )
      }
    })

    it('should throw a write conflict when its lock wait times out, leave the code unspent, and exchange when called again', async () => {
      const created = await createCode()
      const tokens = tokensFor(created)
      const rival = await transactionHolding(
        testPool,
        'SELECT client_id FROM oauth_clients WHERE client_id = ? FOR UPDATE',
        [clientId]
      )
      const impatient = new DrizzleOAuthAuthorizationCodeRepository(
        await impatientDatabase(TEST_DATABASE_URL)
      )

      const thrown: unknown = await impatient
        .exchange(created.id, tokens)
        .catch((error: unknown) => error)
      await rival.rollback()

      expect(thrown).toBeInstanceOf(WriteConflictError)
      expect((await repository.findById(created.id))?.consumedAt).toBeNull()
      expect(await repository.exchange(created.id, tokens)).toBe('exchanged')
    })

    it('should not leave live tokens when the user revokes everything mid-exchange', async () => {
      const created = await createCode()
      const [access, refresh] = tokensFor(created)
      // Holding the client row stalls the first token insert's foreign key
      // check, after the exchange has spent the code.
      const stall = await testPool.getConnection()
      await stall.beginTransaction()
      await stall.query(
        'SELECT client_id FROM oauth_clients WHERE client_id = ? FOR UPDATE',
        [clientId]
      )
      const exchanging = repository.exchange(created.id, [access, refresh])
      await new Promise(resolve => setTimeout(resolve, 200))
      const revoking = new DrizzleUserRepository(testDb).removeRoleAndRevoke(
        userId,
        Role.User
      )
      await new Promise(resolve => setTimeout(resolve, 200))
      await stall.commit()
      stall.release()

      await Promise.all([exchanging, revoking])

      expect((await stored(access))?.revokedAt).toBeInstanceOf(Date)
      expect((await stored(refresh))?.revokedAt).toBeInstanceOf(Date)
    })
  })

  describe('a write whose lock wait times out', () => {
    const impatient = async () =>
      new DrizzleOAuthAuthorizationCodeRepository(
        await impatientDatabase(TEST_DATABASE_URL)
      )
    const holdingClient = () =>
      transactionHolding(
        testPool,
        'SELECT client_id FROM oauth_clients WHERE client_id = ? FOR UPDATE',
        [clientId]
      )

    it('create throws a write conflict, writes nothing, and creates when called again', async () => {
      const data = code()
      const rival = await holdingClient()

      const thrown: unknown = await (
        await impatient()
      )
        .create(data, sessionId)
        .catch((error: unknown) => error)
      await rival.rollback()

      expect(thrown).toBeInstanceOf(WriteConflictError)
      expect(await repository.findByCodeHash(data.codeHash)).toBeNull()
      expect(await repository.create(data, sessionId)).not.toBeNull()
    })

    it('consume throws a write conflict, leaves the code unspent, and consumes when called again', async () => {
      const created = await createCode()
      const rival = await transactionHolding(
        testPool,
        'SELECT id FROM oauth_authorization_codes WHERE id = ? FOR UPDATE',
        [created.id]
      )

      const thrown: unknown = await (
        await impatient()
      )
        .consume(created.codeHash)
        .catch((error: unknown) => error)
      await rival.rollback()

      expect(thrown).toBeInstanceOf(WriteConflictError)
      expect((await repository.findById(created.id))?.consumedAt).toBeNull()
      expect(await repository.consume(created.codeHash)).not.toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete a code', async () => {
      const created = await createCode()

      expect(await repository.delete(created.id)).toBe(true)
      expect(await repository.findById(created.id)).toBeNull()
    })

    it('should return false for a non-existent code', async () => {
      expect(await repository.delete('non-existent-id')).toBe(false)
    })
  })

  describe('deleteExpiredCodes', () => {
    it('should delete expired codes, spent or not, and keep live ones', async () => {
      const expired = await createCode()
      await testDb
        .update(oauthAuthorizationCodes)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(oauthAuthorizationCodes.id, expired.id))
      const live = await createCode()
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
