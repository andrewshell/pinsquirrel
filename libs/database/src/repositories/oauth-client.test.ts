import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import { eq } from 'drizzle-orm'
import type { CreateOAuthClientData } from '@pinsquirrel/domain'
import { oauthClients } from '../schema/oauth-clients.js'
import { DrizzleOAuthClientRepository } from './oauth-client.js'

describe('DrizzleOAuthClientRepository - Integration Tests', () => {
  let testDb: MySql2Database
  let testPool: Pool
  let repository: DrizzleOAuthClientRepository

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel_test'

  const dcrClient = (
    overrides: Partial<CreateOAuthClientData> = {}
  ): CreateOAuthClientData => ({
    clientId: `client-${crypto.randomUUID()}`,
    clientName: 'Test Client',
    redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    tokenEndpointAuthMethod: 'none',
    registrationType: 'dcr',
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
    repository = new DrizzleOAuthClientRepository(testDb)

    await testPool.query('DELETE FROM oauth_tokens')
    await testPool.query('DELETE FROM oauth_authorization_codes')
    await testPool.query('DELETE FROM oauth_clients')
  })

  describe('create', () => {
    it('should create a client and return it', async () => {
      const data = dcrClient()

      const result = await repository.create(data)

      expect(result).toMatchObject({
        clientId: data.clientId,
        clientName: 'Test Client',
        redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
        grantTypes: ['authorization_code', 'refresh_token'],
        tokenEndpointAuthMethod: 'none',
        registrationType: 'dcr',
        metadataUrl: null,
        metadataFetchedAt: null,
        completedAt: null,
      })
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should keep the CIMD metadata URL and fetch time', async () => {
      const fetchedAt = new Date()

      const result = await repository.create(
        dcrClient({
          registrationType: 'cimd',
          clientId: 'https://claude.ai/oauth/claude-code-client-metadata',
          metadataUrl: 'https://claude.ai/oauth/claude-code-client-metadata',
          metadataFetchedAt: fetchedAt,
        })
      )

      expect(result.registrationType).toBe('cimd')
      expect(result.metadataUrl).toBe(
        'https://claude.ai/oauth/claude-code-client-metadata'
      )
      expect(result.metadataFetchedAt?.getTime()).toBe(fetchedAt.getTime())
    })

    it('should return the existing row when the client id is already taken', async () => {
      const data = dcrClient()

      const [first, second] = await Promise.all([
        repository.create(data),
        repository.create(data),
      ])

      expect(second.id).toBe(first.id)
      expect(await repository.findByClientId(data.clientId)).toMatchObject({
        id: first.id,
      })
    })
  })

  describe('findByClientId', () => {
    it('should find the client by the identifier it sends', async () => {
      const created = await repository.create(dcrClient())

      const result = await repository.findByClientId(created.clientId)

      expect(result?.id).toBe(created.id)
      expect(result?.redirectUris).toEqual([
        'https://claude.ai/api/mcp/auth_callback',
      ])
    })

    it('should return null for an unregistered client id', async () => {
      const result = await repository.findByClientId('never-registered')
      expect(result).toBeNull()
    })

    it.each([
      ['an accent variant', 'https://clàude.example/c.json'],
      ['a case variant', 'https://CLAUDE.example/C.json'],
    ])(
      'should return null for %s of a stored client id',
      async (_, variant) => {
        await repository.create(
          dcrClient({
            clientId: 'https://claude.example/c.json',
            registrationType: 'cimd',
          })
        )

        expect(await repository.findByClientId(variant)).toBeNull()
      }
    )
  })

  describe('findById', () => {
    it('should find the client by row id', async () => {
      const created = await repository.create(dcrClient())

      const result = await repository.findById(created.id)

      expect(result?.clientId).toBe(created.clientId)
    })

    it('should return null for a non-existent id', async () => {
      const result = await repository.findById('non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('should replace the metadata a CIMD re-fetch refreshes', async () => {
      const created = await repository.create(
        dcrClient({
          registrationType: 'cimd',
          metadataUrl: 'https://example.com/client.json',
          metadataFetchedAt: new Date(Date.now() - 60 * 60 * 1000),
        })
      )
      const fetchedAt = new Date()

      const updated = await repository.update(created.id, {
        clientName: 'Renamed Client',
        redirectUris: ['https://example.com/callback'],
        metadataFetchedAt: fetchedAt,
      })

      expect(updated).toMatchObject({
        id: created.id,
        clientName: 'Renamed Client',
        redirectUris: ['https://example.com/callback'],
        // Untouched fields survive a partial update.
        grantTypes: ['authorization_code', 'refresh_token'],
        registrationType: 'cimd',
      })
      expect(updated?.metadataFetchedAt?.getTime()).toBe(fetchedAt.getTime())
    })

    it('should return the client unchanged when there is nothing to update', async () => {
      const created = await repository.create(dcrClient())

      const updated = await repository.update(created.id, {})

      expect(updated?.clientName).toBe('Test Client')
    })

    it('should return null for a non-existent client', async () => {
      const result = await repository.update('non-existent-id', {
        clientName: 'Nobody',
      })
      expect(result).toBeNull()
    })
  })

  describe('markCompleted', () => {
    it('should record when the registration first completed an authorization', async () => {
      const created = await repository.create(dcrClient())
      const completedAt = new Date()

      await repository.markCompleted(created.id, completedAt)

      const found = await repository.findById(created.id)
      expect(found?.completedAt?.getTime()).toBe(completedAt.getTime())
    })
  })

  describe('delete', () => {
    it('should delete a client', async () => {
      const created = await repository.create(dcrClient())

      expect(await repository.delete(created.id)).toBe(true)
      expect(await repository.findById(created.id)).toBeNull()
    })

    it('should return false for a non-existent client', async () => {
      expect(await repository.delete('non-existent-id')).toBe(false)
    })
  })

  describe('deleteExpiredIncompleteClients', () => {
    const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000)

    // Backdate through Drizzle, not through a raw pool query. Drizzle writes
    // a timestamp as UTC while mysql2 writes it in the process timezone, so a
    // fixture inserted the second way is compared against a cutoff written
    // the first way and is off by the local UTC offset.
    const createdAgo = async (
      data: CreateOAuthClientData,
      msAgo: number
    ): Promise<string> => {
      const created = await repository.create(data)
      await testDb
        .update(oauthClients)
        .set({ createdAt: new Date(Date.now() - msAgo) })
        .where(eq(oauthClients.id, created.id))
      return created.id
    }

    it('should delete only DCR registrations that never completed one', async () => {
      const stale = await createdAgo(dcrClient(), 2 * 60 * 60 * 1000)
      const completed = await createdAgo(dcrClient(), 2 * 60 * 60 * 1000)
      await repository.markCompleted(completed, new Date())
      const recent = await createdAgo(dcrClient(), 60 * 1000)

      const deleted =
        await repository.deleteExpiredIncompleteClients(anHourAgo())

      expect(deleted).toBe(1)
      expect(await repository.findById(stale)).toBeNull()
      expect(await repository.findById(completed)).not.toBeNull()
      expect(await repository.findById(recent)).not.toBeNull()
    })

    it('should delete CIMD registrations that never completed one', async () => {
      const stale = await createdAgo(
        dcrClient({ registrationType: 'cimd' }),
        2 * 60 * 60 * 1000
      )
      const completed = await createdAgo(
        dcrClient({ registrationType: 'cimd' }),
        2 * 60 * 60 * 1000
      )
      await repository.markCompleted(completed, new Date())

      const deleted =
        await repository.deleteExpiredIncompleteClients(anHourAgo())

      expect(deleted).toBe(1)
      expect(await repository.findById(stale)).toBeNull()
      expect(await repository.findById(completed)).not.toBeNull()
    })

    it('should keep an incomplete registration whose clock was restarted', async () => {
      const renewed = await createdAgo(dcrClient(), 2 * 60 * 60 * 1000)
      await repository.renewRegistration(renewed, new Date())

      await repository.deleteExpiredIncompleteClients(anHourAgo())

      expect(await repository.findById(renewed)).not.toBeNull()
    })

    it('should leave a completed registration where it was when asked to restart it', async () => {
      const completed = await createdAgo(dcrClient(), 2 * 60 * 60 * 1000)
      await repository.markCompleted(completed, new Date())
      const before = (await repository.findById(completed))!.createdAt

      await repository.renewRegistration(completed, new Date())

      expect((await repository.findById(completed))!.createdAt).toEqual(before)
    })

    it('should never touch a static registration', async () => {
      const staticClient = await createdAgo(
        dcrClient({ registrationType: 'static' }),
        30 * 24 * 60 * 60 * 1000
      )

      const deleted =
        await repository.deleteExpiredIncompleteClients(anHourAgo())

      expect(deleted).toBe(0)
      expect(await repository.findById(staticClient)).not.toBeNull()
    })

    it('should return 0 when there is nothing to sweep', async () => {
      expect(await repository.deleteExpiredIncompleteClients(anHourAgo())).toBe(
        0
      )
    })

    it('indexes the columns the sweep filters on', async () => {
      // The sweep runs against the one table an unauthenticated caller can
      // grow. There is no behavioural assertion for an index, so assert the
      // schema directly, as the sessions sweep test does.
      const [result] = await testPool.query(
        'SHOW INDEX FROM oauth_clients WHERE Key_name = ?',
        ['oauth_clients_incomplete_idx']
      )
      const rows = result as { Column_name: string }[]

      expect(rows.map(r => r.Column_name)).toEqual([
        'registration_type',
        'completed_at',
        'created_at',
      ])
    })
  })
})
