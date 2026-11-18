import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { Pool, PoolConnection } from 'mysql2/promise'
import { eq } from 'drizzle-orm'
import { WriteConflictError } from '@pinsquirrel/domain'
import type { CreateOAuthTokenData } from '@pinsquirrel/domain'
import {
  heavyTransaction,
  impatientDatabase,
  insertUser,
  transactionHolding,
} from '../test-fixtures.js'
import { oauthTokens } from '../schema/oauth-tokens.js'
import { DrizzleOAuthClientRepository } from './oauth-client.js'
import { PRIMARY_KEY_BATCH } from './oauth-issuance.js'
import { DrizzleOAuthTokenRepository } from './oauth-token.js'

describe('DrizzleOAuthTokenRepository - Integration Tests', () => {
  let testDb: MySql2Database
  let testPool: Pool
  let repository: DrizzleOAuthTokenRepository
  let clients: DrizzleOAuthClientRepository
  let userId: string
  let clientId: string

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel_test'

  const MCP = 'https://pinsquirrel.com/mcp'

  const token = (
    overrides: Partial<CreateOAuthTokenData> = {}
  ): CreateOAuthTokenData => ({
    tokenHash: crypto.randomUUID().replace(/-/g, '').repeat(2),
    kind: 'access',
    clientId,
    userId,
    scopes: ['pins:read', 'tags:read'],
    resource: MCP,
    grantId: crypto.randomUUID(),
    grantedAt: new Date(Date.now() - 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  })

  const registerClient = async (name: string): Promise<string> =>
    (
      await clients.create({
        clientId: `client-${name}-${crypto.randomUUID()}`,
        clientName: name,
        redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
        grantTypes: ['authorization_code', 'refresh_token'],
        tokenEndpointAuthMethod: 'none',
        registrationType: 'dcr',
      })
    ).clientId

  const retire = async (id: string): Promise<void> => {
    await testDb
      .update(oauthTokens)
      .set({ rotatedAt: new Date() })
      .where(eq(oauthTokens.id, id))
  }

  const settles = async (work: Promise<unknown>): Promise<boolean> => {
    let settled = false
    void work.then(
      () => (settled = true),
      () => (settled = true)
    )
    await new Promise(resolve => setTimeout(resolve, 500))
    return settled
  }

  /**
   * Holds the client row, which stalls an issuance at its first insert's
   * foreign key check.
   */
  const heavierRival = async (): Promise<PoolConnection> => {
    const rival = await heavyTransaction(testPool)
    await rival.query(
      'SELECT client_id FROM oauth_clients WHERE client_id = ? FOR UPDATE',
      [clientId]
    )
    return rival
  }

  const seedTokens = async (count: number, expiresAt: Date): Promise<void> => {
    const rows = Array.from({ length: count }, () => {
      const data = token()
      return [
        crypto.randomUUID(),
        data.tokenHash,
        data.kind,
        clientId,
        userId,
        JSON.stringify(data.scopes),
        data.resource,
        expiresAt,
      ]
    })
    await testPool.query(
      `INSERT INTO oauth_tokens
         (id, token_hash, kind, client_id, user_id, scopes, resource, expires_at)
       VALUES ?`,
      [rows]
    )
  }

  /**
   * Stalls the insert of a token before any of its foreign key checks: the
   * insert waits on an uncommitted row with the same hash, and goes ahead
   * when that row is rolled back.
   */
  const stallInsertOf = async (
    data: CreateOAuthTokenData
  ): Promise<PoolConnection> => {
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
        data.tokenHash,
        data.kind,
        clientId,
        holder.id,
        JSON.stringify(data.scopes),
        data.resource,
        data.expiresAt,
      ]
    )
    return stall
  }

  const pause = () => new Promise(resolve => setTimeout(resolve, 200))

  const expire = async (id: string): Promise<void> => {
    await testDb
      .update(oauthTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(oauthTokens.id, id))
  }

  beforeAll(() => {
    testPool = mysql.createPool(TEST_DATABASE_URL)
    testDb = drizzle({ client: testPool })
  })

  afterAll(async () => {
    await testPool.end()
  })

  beforeEach(async () => {
    repository = new DrizzleOAuthTokenRepository(testDb)
    clients = new DrizzleOAuthClientRepository(testDb)

    await testPool.query('DELETE FROM oauth_tokens')
    await testPool.query('DELETE FROM oauth_authorization_codes')
    await testPool.query('DELETE FROM oauth_clients')
    await testPool.query('DELETE FROM users')

    userId = (await insertUser(testPool)).id
    clientId = await registerClient('primary')
  })

  describe('create', () => {
    it('should create an access token bound to its resource', async () => {
      const data = token()

      const result = await repository.create(data)

      expect(result).toMatchObject({
        tokenHash: data.tokenHash,
        kind: 'access',
        clientId,
        userId,
        scopes: ['pins:read', 'tags:read'],
        resource: MCP,
        grantId: data.grantId,
        revokedAt: null,
        rotatedAt: null,
        rotatedFrom: null,
      })
      expect(result.id).toBeDefined()
      expect(result.grantedAt?.getTime()).toBe(data.grantedAt.getTime())
      expect(result.expiresAt.getTime()).toBe(data.expiresAt.getTime())
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should record the refresh token a rotation replaced', async () => {
      const first = await repository.create(token({ kind: 'refresh' }))

      const second = await repository.create(
        token({ kind: 'refresh', rotatedFrom: first.id })
      )

      expect(second.rotatedFrom).toBe(first.id)
    })

    it('should reject a duplicate token hash', async () => {
      const data = token()
      await repository.create(data)

      await expect(repository.create(data)).rejects.toThrow()
    })

    it('should go with the user when the user is deleted', async () => {
      const created = await repository.create(token())

      await testPool.query('DELETE FROM users WHERE id = ?', [userId])

      expect(await repository.findById(created.id)).toBeNull()
    })
  })

  describe('findByTokenHash', () => {
    it('should find a token by its hash whatever its state', async () => {
      const created = await repository.create(token())
      await repository.revoke(created.id)

      const result = await repository.findByTokenHash(created.tokenHash)

      // Expiry, revocation and audience are the service's checks to make;
      // the repository hands back what it has.
      expect(result?.id).toBe(created.id)
      expect(result?.revokedAt).toBeInstanceOf(Date)
    })

    it('should return null for an unknown hash', async () => {
      expect(await repository.findByTokenHash('nope')).toBeNull()
    })
  })

  describe('findActiveByUserId', () => {
    it('should return only tokens that can still authenticate', async () => {
      const live = await repository.create(token())

      const expired = await repository.create(token())
      await expire(expired.id)

      const revoked = await repository.create(token())
      await repository.revoke(revoked.id)

      const rotated = await repository.create(token({ kind: 'refresh' }))
      await retire(rotated.id)

      const result = await repository.findActiveByUserId(userId)

      expect(result.map(t => t.id)).toEqual([live.id])
    })

    it('should not return another user grant', async () => {
      const otherUser = await insertUser(testPool, {
        emailHash: crypto.randomUUID(),
      })
      await repository.create(token({ userId: otherUser.id }))

      expect(await repository.findActiveByUserId(userId)).toEqual([])
    })
  })

  describe('revoke', () => {
    it('should revoke a live token once', async () => {
      const created = await repository.create(token())

      expect(await repository.revoke(created.id)).toBe(true)
      expect((await repository.findById(created.id))?.revokedAt).toBeInstanceOf(
        Date
      )
      expect(await repository.revoke(created.id)).toBe(false)
    })

    it('should return false for a non-existent token', async () => {
      expect(await repository.revoke('non-existent-id')).toBe(false)
    })
  })

  describe('revokeByUserAndClient', () => {
    it('should kill the access and refresh tokens of one grant together', async () => {
      const access = await repository.create(token())
      const refresh = await repository.create(token({ kind: 'refresh' }))
      const otherClient = await repository.create(
        token({ clientId: await registerClient('other') })
      )

      const revoked = await repository.revokeByUserAndClient(userId, clientId)

      expect(revoked).toBe(2)
      expect((await repository.findById(access.id))?.revokedAt).not.toBeNull()
      expect((await repository.findById(refresh.id))?.revokedAt).not.toBeNull()
      // Revoking one grant must not sign the user out of every client.
      expect((await repository.findById(otherClient.id))?.revokedAt).toBeNull()
    })

    it('should leave another user grant for the same client alone', async () => {
      const otherUser = await insertUser(testPool, {
        emailHash: crypto.randomUUID(),
      })
      const theirs = await repository.create(token({ userId: otherUser.id }))

      expect(await repository.revokeByUserAndClient(userId, clientId)).toBe(0)
      expect((await repository.findById(theirs.id))?.revokedAt).toBeNull()
    })

    it('should count only the tokens it actually revoked', async () => {
      const already = await repository.create(token())
      await repository.revoke(already.id)

      expect(await repository.revokeByUserAndClient(userId, clientId)).toBe(0)
    })
  })

  describe('a revocation of more tokens than one batch holds', () => {
    it('should revoke every one of them', async () => {
      await seedTokens(1100, new Date(Date.now() + 60 * 60 * 1000))

      expect(await repository.revokeByUserAndClient(userId, clientId)).toBe(
        1100
      )
      const [unrevoked] = await testPool.query(
        'SELECT id FROM oauth_tokens WHERE revoked_at IS NULL'
      )
      expect(unrevoked).toEqual([])
    })
  })

  describe('a revocation that loses a deadlock', () => {
    it.each([
      [
        'revokeByUserAndClient',
        () => repository.revokeByUserAndClient(userId, clientId),
      ],
      ['revokeByGrant', () => repository.revokeByGrant(userId, 'held')],
    ])('%s runs again, and revokes', async (_name, revoke) => {
      const held = await repository.create(token({ grantId: 'held' }))
      const rival = await heavyTransaction(testPool)
      await rival.query('SELECT id FROM oauth_tokens WHERE id = ? FOR UPDATE', [
        held.id,
      ])

      const revoking = revoke()
      await pause()
      await rival.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [
        userId,
      ])
      await pause()
      await rival.rollback()

      expect(await revoking).toBe(1)
      expect((await repository.findById(held.id))?.revokedAt).toBeInstanceOf(
        Date
      )
    })
  })

  describe('a revocation that loses a deadlock twice', () => {
    it.each([
      [
        'revokeByUserAndClient',
        () => repository.revokeByUserAndClient(userId, clientId),
      ],
      ['revokeByGrant', () => repository.revokeByGrant(userId, 'held')],
    ])(
      '%s throws a write conflict, leaves the grant live, and revokes it when called again',
      async (_name, revoke) => {
        const holdToken = 'SELECT id FROM oauth_tokens WHERE id = ? FOR UPDATE'
        const holdUser = 'SELECT id FROM users WHERE id = ? FOR UPDATE'
        const held = await repository.create(token({ grantId: 'held' }))
        const first = await heavyTransaction(testPool)
        const second = await heavyTransaction(testPool)
        await first.query(holdToken, [held.id])

        const revoking = revoke().catch((error: unknown) => error)
        await pause()
        await first.query(holdUser, [userId])
        const secondHoldsToken = second.query(holdToken, [held.id])
        await pause()
        await first.rollback()
        await secondHoldsToken
        await pause()
        await second.query(holdUser, [userId])
        const thrown = await Promise.race([revoking, pause()])
        await second.rollback()

        expect(thrown).toBeInstanceOf(WriteConflictError)
        expect((await repository.findById(held.id))?.revokedAt).toBeNull()
        expect(await revoke()).toBe(1)
        expect((await repository.findById(held.id))?.revokedAt).toBeInstanceOf(
          Date
        )
      }
    )
  })

  describe('a write whose lock wait times out', () => {
    const impatient = async () =>
      new DrizzleOAuthTokenRepository(
        await impatientDatabase(TEST_DATABASE_URL)
      )

    it.each([
      [
        'revokeByUserAndClient',
        (tokens: DrizzleOAuthTokenRepository) =>
          tokens.revokeByUserAndClient(userId, clientId),
      ],
      [
        'revokeByGrant',
        (tokens: DrizzleOAuthTokenRepository) =>
          tokens.revokeByGrant(userId, 'held'),
      ],
    ])(
      '%s throws a write conflict, leaves the grant live, and revokes it when called again',
      async (_name, revoke) => {
        const held = await repository.create(token({ grantId: 'held' }))
        const rival = await transactionHolding(
          testPool,
          'SELECT id FROM oauth_tokens WHERE id = ? FOR UPDATE',
          [held.id]
        )

        const thrown: unknown = await revoke(await impatient()).catch(
          (error: unknown) => error
        )
        await rival.rollback()

        expect(thrown).toBeInstanceOf(WriteConflictError)
        expect((await repository.findById(held.id))?.revokedAt).toBeNull()
        expect(await revoke(repository)).toBe(1)
      }
    )

    it('revoke throws a write conflict, leaves the token live, and revokes it when called again', async () => {
      const held = await repository.create(token())
      const rival = await transactionHolding(
        testPool,
        'SELECT id FROM oauth_tokens WHERE id = ? FOR UPDATE',
        [held.id]
      )

      const thrown: unknown = await (
        await impatient()
      )
        .revoke(held.id)
        .catch((error: unknown) => error)
      await rival.rollback()

      expect(thrown).toBeInstanceOf(WriteConflictError)
      expect((await repository.findById(held.id))?.revokedAt).toBeNull()
      expect(await repository.revoke(held.id)).toBe(true)
    })
  })

  describe('a revocation while another user refreshes', () => {
    it('does not wait on the other user, whose refresh then writes its tokens', async () => {
      for (let i = 0; i < 30; i++) {
        await repository.create(token())
      }
      const other = (
        await insertUser(testPool, { emailHash: crypto.randomUUID() })
      ).id
      const parent = await repository.create(
        token({ kind: 'refresh', userId: other })
      )
      await testPool.query('ANALYZE TABLE oauth_tokens')

      const refreshing = await testPool.getConnection()
      await refreshing.beginTransaction()
      await refreshing.query('SELECT id FROM users WHERE id = ? FOR SHARE', [
        other,
      ])
      await refreshing.query(
        'UPDATE oauth_tokens SET rotated_at = NOW(3) WHERE id = ?',
        [parent.id]
      )

      const revoking = repository.revokeByUserAndClient(userId, clientId)
      const settledWhileRefreshing = await settles(revoking)

      const successor = token({ kind: 'refresh', userId: other })
      const written = await refreshing
        .query(
          `INSERT INTO oauth_tokens
             (id, token_hash, kind, client_id, user_id, scopes, resource, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `00000000-${crypto.randomUUID().slice(9)}`,
            successor.tokenHash,
            successor.kind,
            clientId,
            other,
            JSON.stringify(successor.scopes),
            successor.resource,
            successor.expiresAt,
          ]
        )
        .then(
          () => 'written',
          (error: { code?: string }) => error.code
        )
      await refreshing.rollback()
      refreshing.release()

      expect(settledWhileRefreshing).toBe(true)
      expect(written).toBe('written')
      expect(await revoking).toBe(30)
    })
  })

  describe('revokeByGrant', () => {
    it('should kill the access and refresh tokens of that grant', async () => {
      const grantId = crypto.randomUUID()
      const access = await repository.create(token({ grantId }))
      const refresh = await repository.create(
        token({ kind: 'refresh', grantId })
      )

      expect(await repository.revokeByGrant(userId, grantId)).toBe(2)
      expect((await repository.findById(access.id))?.revokedAt).not.toBeNull()
      expect((await repository.findById(refresh.id))?.revokedAt).not.toBeNull()
    })

    it('should leave another grant of the same user and client alone', async () => {
      const laptop = crypto.randomUUID()
      const desktop = await repository.create(token({ kind: 'refresh' }))
      await repository.create(token({ kind: 'refresh', grantId: laptop }))

      await repository.revokeByGrant(userId, laptop)

      expect((await repository.findById(desktop.id))?.revokedAt).toBeNull()
    })

    it('should not revoke a grant on behalf of another user', async () => {
      const otherUser = await insertUser(testPool, {
        emailHash: crypto.randomUUID(),
      })
      const created = await repository.create(token())

      expect(
        await repository.revokeByGrant(otherUser.id, created.grantId ?? '')
      ).toBe(0)
      expect((await repository.findById(created.id))?.revokedAt).toBeNull()
    })
  })

  describe('rotate', () => {
    const successorsOf = (parent: { id: string; grantId: string | null }) =>
      [
        token({ grantId: parent.grantId ?? crypto.randomUUID() }),
        token({
          kind: 'refresh',
          grantId: parent.grantId ?? crypto.randomUUID(),
          rotatedFrom: parent.id,
        }),
      ] as [CreateOAuthTokenData, CreateOAuthTokenData]

    it('should retire the token and write its successors', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      const successors = successorsOf(parent)

      expect(await repository.rotate(parent.id, successors)).toBe(true)

      const retired = await repository.findById(parent.id)
      expect(retired?.rotatedAt).toBeInstanceOf(Date)
      // A replayed rotated token has to stay distinguishable from one a user
      // deliberately killed.
      expect(retired?.revokedAt).toBeNull()
      for (const successor of successors) {
        expect(
          await repository.findByTokenHash(successor.tokenHash)
        ).toMatchObject({ grantId: parent.grantId, revokedAt: null })
      }
    })

    it('should leave the token unrotated when a successor cannot be written', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      const taken = await repository.create(token())
      const [access, refresh] = successorsOf(parent)

      await expect(
        repository.rotate(parent.id, [
          access,
          { ...refresh, tokenHash: taken.tokenHash },
        ])
      ).rejects.toThrow()

      expect((await repository.findById(parent.id))?.rotatedAt).toBeNull()
      expect(await repository.findByTokenHash(access.tokenHash)).toBeNull()
    })

    it('should write nothing for a token that was already rotated', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      await repository.rotate(parent.id, successorsOf(parent))
      const late = successorsOf(parent)

      expect(await repository.rotate(parent.id, late)).toBe(false)
      expect(await repository.findByTokenHash(late[0].tokenHash)).toBeNull()
    })

    it('should write nothing for a token revoked after it was read', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      await repository.revoke(parent.id)
      const late = successorsOf(parent)

      expect(await repository.rotate(parent.id, late)).toBe(false)
      expect(await repository.findByTokenHash(late[0].tokenHash)).toBeNull()
    })

    it('should let exactly one of two concurrent rotations win', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))

      const results = await Promise.all([
        repository.rotate(parent.id, successorsOf(parent)),
        repository.rotate(parent.id, successorsOf(parent)),
      ])

      expect(results.filter(Boolean)).toHaveLength(1)
      const [rows] = await testPool.query(
        'SELECT id FROM oauth_tokens WHERE rotated_from = ?',
        [parent.id]
      )
      expect(rows).toHaveLength(1)
    })

    it('should run again when it loses a deadlock, and write its successors', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      const successors = successorsOf(parent)
      const rival = await heavierRival()

      const rotating = repository.rotate(parent.id, successors)
      await pause()
      await rival.query('SELECT id FROM oauth_tokens WHERE id = ? FOR UPDATE', [
        parent.id,
      ])
      await pause()
      await rival.rollback()

      expect(await rotating).toBe(true)
      for (const successor of successors) {
        expect(
          await repository.findByTokenHash(successor.tokenHash)
        ).not.toBeNull()
      }
    })

    it('should refuse on its second run a token that was revoked during the first', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      const successors = successorsOf(parent)
      const rival = await heavierRival()

      const rotating = repository.rotate(parent.id, successors)
      await pause()
      await rival.query(
        'UPDATE oauth_tokens SET revoked_at = NOW(3) WHERE id = ?',
        [parent.id]
      )
      await rival.commit()

      expect(await rotating).toBe(false)
      for (const successor of successors) {
        expect(await repository.findByTokenHash(successor.tokenHash)).toBeNull()
      }
    })

    it('should throw a write conflict, and leave the token to rotate later, when it loses a deadlock twice', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      const successors = successorsOf(parent)
      const rival = await heavierRival()

      const rotating = repository.rotate(parent.id, successors)
      await pause()
      await rival.query('SELECT id FROM oauth_tokens WHERE id = ? FOR UPDATE', [
        parent.id,
      ])
      await pause()
      await rival.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [
        userId,
      ])
      const thrown = await Promise.race([
        rotating.catch((error: unknown) => error),
        pause(),
      ])
      await rival.rollback()

      expect(thrown).toBeInstanceOf(WriteConflictError)
      expect((await repository.findById(parent.id))?.rotatedAt).toBeNull()
      for (const successor of successors) {
        expect(await repository.findByTokenHash(successor.tokenHash)).toBeNull()
      }
      expect(await repository.rotate(parent.id, successors)).toBe(true)
    })

    it('should throw a write conflict when its lock wait times out, undo the retirement it had made, and rotate when called again', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      const successors = successorsOf(parent)
      const rival = await transactionHolding(
        testPool,
        'SELECT client_id FROM oauth_clients WHERE client_id = ? FOR UPDATE',
        [clientId]
      )
      const impatient = new DrizzleOAuthTokenRepository(
        await impatientDatabase(TEST_DATABASE_URL)
      )

      const thrown: unknown = await impatient
        .rotate(parent.id, successors)
        .catch((error: unknown) => error)
      await rival.rollback()

      expect(thrown).toBeInstanceOf(WriteConflictError)
      expect((await repository.findById(parent.id))?.rotatedAt).toBeNull()
      expect(await repository.rotate(parent.id, successors)).toBe(true)
    })

    it('should not leave live tokens when the client is revoked between the retire and the inserts', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      const successors = successorsOf(parent)
      const stall = await stallInsertOf(successors[0])
      const rotating = repository.rotate(parent.id, successors)
      await pause()
      const revoking = repository.revokeByUserAndClient(userId, clientId)
      await pause()
      await stall.rollback()
      stall.release()

      await Promise.all([rotating, revoking])

      for (const successor of successors) {
        expect(
          (await repository.findByTokenHash(successor.tokenHash))?.revokedAt
        ).toBeInstanceOf(Date)
      }
    })

    it('should bring a token from before grant ids into the grant of its successors', async () => {
      const parent = await repository.create(token({ kind: 'refresh' }))
      await testPool.query(
        'UPDATE oauth_tokens SET grant_id = NULL WHERE id = ?',
        [parent.id]
      )
      const successors = successorsOf({ id: parent.id, grantId: 'adopted' })

      await repository.rotate(parent.id, successors)

      expect((await repository.findById(parent.id))?.grantId).toBe('adopted')
    })
  })

  describe('a revocation while tokens are being issued', () => {
    it.each([
      [
        'revokeByUserAndClient',
        () => repository.revokeByUserAndClient(userId, clientId),
      ],
      ['revokeByGrant', () => repository.revokeByGrant(userId, 'in-flight')],
    ])('%s waits, then takes the new tokens too', async (_name, revoke) => {
      const issuing = await testPool.getConnection()
      await issuing.beginTransaction()
      await issuing.query('SELECT id FROM users WHERE id = ? FOR SHARE', [
        userId,
      ])
      const issued = token({ grantId: 'in-flight' })

      let settled = false
      const revoking = revoke().finally(() => {
        settled = true
      })
      await new Promise(resolve => setTimeout(resolve, 200))
      const settledWhileIssuing = settled

      await issuing.query(
        `INSERT INTO oauth_tokens
           (id, token_hash, kind, client_id, user_id, scopes, resource, grant_id, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          issued.tokenHash,
          issued.kind,
          clientId,
          userId,
          JSON.stringify(issued.scopes),
          issued.resource,
          issued.grantId,
          issued.expiresAt,
        ]
      )
      await issuing.commit()
      issuing.release()

      expect(settledWhileIssuing).toBe(false)
      expect(await revoking).toBe(1)
      expect(
        (await repository.findByTokenHash(issued.tokenHash))?.revokedAt
      ).toBeInstanceOf(Date)
    })
  })

  describe('deleteExpiredTokens', () => {
    it('should delete every expired or revoked token', async () => {
      const live = await repository.create(token())

      const expired = await repository.create(token())
      await expire(expired.id)

      const revoked = await repository.create(token())
      await repository.revoke(revoked.id)

      const rotatedAndExpired = await repository.create(
        token({ kind: 'refresh' })
      )
      await retire(rotatedAndExpired.id)
      await expire(rotatedAndExpired.id)

      const deleted = await repository.deleteExpiredTokens()

      expect(deleted).toBe(3)
      expect(await repository.findById(live.id)).not.toBeNull()
      for (const dead of [expired, revoked, rotatedAndExpired]) {
        expect(await repository.findById(dead.id)).toBeNull()
      }
    })

    it('should not wait on a live token that a refresh holds', async () => {
      const live = await repository.create(token({ kind: 'refresh' }))
      const expired = await repository.create(token())
      await expire(expired.id)
      const refreshing = await testPool.getConnection()
      await refreshing.beginTransaction()
      await refreshing.query(
        'UPDATE oauth_tokens SET rotated_at = NOW(3) WHERE id = ?',
        [live.id]
      )

      const sweeping = repository.deleteExpiredTokens()
      const settledWhileRefreshing = await settles(sweeping)
      await refreshing.rollback()
      refreshing.release()

      expect(settledWhileRefreshing).toBe(true)
      expect(await sweeping).toBe(1)
      expect(await repository.findById(expired.id)).toBeNull()
    })

    it('should not wait on a live token that a refresh holds, among more dead tokens than one batch holds', async () => {
      const live = await repository.create(token({ kind: 'refresh' }))
      await seedTokens(1100, new Date(Date.now() - 1000))
      await testPool.query('ANALYZE TABLE oauth_tokens')
      const refreshing = await testPool.getConnection()
      await refreshing.beginTransaction()
      await refreshing.query(
        'UPDATE oauth_tokens SET rotated_at = NOW(3) WHERE id = ?',
        [live.id]
      )

      const sweeping = repository.deleteExpiredTokens()
      const settledWhileRefreshing = await settles(sweeping)
      await refreshing.rollback()
      refreshing.release()

      expect(settledWhileRefreshing).toBe(true)
      expect(await sweeping).toBe(1100)
    })

    it('should delete more dead tokens than one batch holds', async () => {
      await seedTokens(1100, new Date(Date.now() - 1000))
      const live = await repository.create(token())

      expect(await repository.deleteExpiredTokens()).toBe(1100)
      expect(await repository.findById(live.id)).not.toBeNull()
    })

    it('should read no more dead tokens at once than one batch holds', async () => {
      await seedTokens(1100, new Date(Date.now() - 1000))
      let largestRead = 0
      const counting = new Proxy(testPool, {
        get(pool, property, receiver) {
          if (property !== 'query') {
            return Reflect.get(pool, property, receiver) as unknown
          }
          return async (...args: Parameters<Pool['query']>) => {
            const result = await pool.query(...args)
            if (Array.isArray(result[0])) {
              largestRead = Math.max(largestRead, result[0].length)
            }
            return result
          }
        },
      })
      const sweep = new DrizzleOAuthTokenRepository(
        drizzle({ client: counting })
      )

      expect(await sweep.deleteExpiredTokens()).toBe(1100)
      expect(largestRead).toBe(PRIMARY_KEY_BATCH)
    })

    it('should keep a rotated refresh token until its own expiry', async () => {
      const rotated = await repository.create(token({ kind: 'refresh' }))
      await retire(rotated.id)

      await repository.deleteExpiredTokens()

      expect(await repository.findById(rotated.id)).not.toBeNull()
    })

    it('should return 0 when every token is still live', async () => {
      await repository.create(token())

      expect(await repository.deleteExpiredTokens()).toBe(0)
    })

    it('indexes the columns the sweep and the grants list scan on', async () => {
      const indexed = async (name: string): Promise<string[]> => {
        const [result] = await testPool.query(
          'SHOW INDEX FROM oauth_tokens WHERE Key_name = ?',
          [name]
        )
        return (result as { Column_name: string }[]).map(r => r.Column_name)
      }

      expect(await indexed('oauth_tokens_expires_at_idx')).toEqual([
        'expires_at',
      ])
      // One composite index serves both the grants list (user alone) and
      // revoking one grant (user and client).
      expect(await indexed('oauth_tokens_user_client_idx')).toEqual([
        'user_id',
        'client_id',
      ])
      expect(await indexed('oauth_tokens_grant_idx')).toEqual(['grant_id'])
    })
  })
})
