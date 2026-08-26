import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import { eq } from 'drizzle-orm'
import type { CreateOAuthTokenData } from '@pinsquirrel/domain'
import { insertUser } from '../test-fixtures.js'
import { oauthTokens } from '../schema/oauth-tokens.js'
import { DrizzleOAuthClientRepository } from './oauth-client.js'
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
        revokedAt: null,
        rotatedAt: null,
        rotatedFrom: null,
      })
      expect(result.id).toBeDefined()
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
      await repository.markRotated(rotated.id)

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

  describe('findByRotatedFrom', () => {
    it('should find the successor of a rotated refresh token', async () => {
      const first = await repository.create(token({ kind: 'refresh' }))
      const second = await repository.create(
        token({ kind: 'refresh', rotatedFrom: first.id })
      )

      expect((await repository.findByRotatedFrom(first.id))?.id).toBe(second.id)
    })

    it('should return null when the token was never rotated', async () => {
      const only = await repository.create(token({ kind: 'refresh' }))

      expect(await repository.findByRotatedFrom(only.id)).toBeNull()
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

  describe('markRotated', () => {
    it('should mark a refresh token exchanged without calling it revoked', async () => {
      const created = await repository.create(token({ kind: 'refresh' }))

      expect(await repository.markRotated(created.id)).toBe(true)

      const found = await repository.findById(created.id)
      expect(found?.rotatedAt).toBeInstanceOf(Date)
      // A replayed rotated token has to stay distinguishable from one a user
      // deliberately killed.
      expect(found?.revokedAt).toBeNull()
    })

    it('should return false the second time', async () => {
      const created = await repository.create(token({ kind: 'refresh' }))
      await repository.markRotated(created.id)

      expect(await repository.markRotated(created.id)).toBe(false)
    })
  })

  describe('deleteExpiredTokens', () => {
    it('should delete every token that can never authenticate again', async () => {
      const live = await repository.create(token())

      const expired = await repository.create(token())
      await expire(expired.id)

      const revoked = await repository.create(token())
      await repository.revoke(revoked.id)

      const rotated = await repository.create(token({ kind: 'refresh' }))
      await repository.markRotated(rotated.id)

      const deleted = await repository.deleteExpiredTokens()

      expect(deleted).toBe(3)
      expect(await repository.findById(live.id)).not.toBeNull()
      for (const dead of [expired, revoked, rotated]) {
        expect(await repository.findById(dead.id)).toBeNull()
      }
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
    })
  })
})
