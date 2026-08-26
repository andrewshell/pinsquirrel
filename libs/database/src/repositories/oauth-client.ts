import type {
  OAuthClient,
  CreateOAuthClientData,
  UpdateOAuthClientData,
  OAuthClientRepository,
} from '@pinsquirrel/domain'
import { and, eq, isNull, lt } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { oauthClients } from '../schema/oauth-clients'

export class DrizzleOAuthClientRepository implements OAuthClientRepository {
  constructor(private db: MySql2Database) {}

  async findById(id: string): Promise<OAuthClient | null> {
    const result = await this.db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.id, id))
      .limit(1)
    return result[0] || null
  }

  async findByClientId(clientId: string): Promise<OAuthClient | null> {
    const result = await this.db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1)
    return result[0] || null
  }

  async create(data: CreateOAuthClientData): Promise<OAuthClient> {
    const id = crypto.randomUUID()
    const now = new Date()

    await this.db.insert(oauthClients).values({
      id,
      clientId: data.clientId,
      clientName: data.clientName ?? null,
      redirectUris: data.redirectUris,
      grantTypes: data.grantTypes,
      tokenEndpointAuthMethod: data.tokenEndpointAuthMethod,
      registrationType: data.registrationType,
      metadataUrl: data.metadataUrl ?? null,
      metadataFetchedAt: data.metadataFetchedAt ?? null,
      completedAt: null,
      createdAt: now,
    })

    const [created] = await this.db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.id, id))
      .limit(1)

    return created
  }

  async update(
    id: string,
    data: UpdateOAuthClientData
  ): Promise<OAuthClient | null> {
    const updateData: Record<string, unknown> = {}

    if (data.clientName !== undefined) updateData.clientName = data.clientName
    if (data.redirectUris !== undefined)
      updateData.redirectUris = data.redirectUris
    if (data.grantTypes !== undefined) updateData.grantTypes = data.grantTypes
    if (data.tokenEndpointAuthMethod !== undefined)
      updateData.tokenEndpointAuthMethod = data.tokenEndpointAuthMethod
    if (data.metadataUrl !== undefined)
      updateData.metadataUrl = data.metadataUrl
    if (data.metadataFetchedAt !== undefined)
      updateData.metadataFetchedAt = data.metadataFetchedAt

    if (Object.keys(updateData).length === 0) {
      return await this.findById(id)
    }

    await this.db
      .update(oauthClients)
      .set(updateData)
      .where(eq(oauthClients.id, id))

    return await this.findById(id)
  }

  async markCompleted(id: string, date: Date): Promise<void> {
    await this.db
      .update(oauthClients)
      .set({ completedAt: date })
      .where(eq(oauthClients.id, id))
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(oauthClients)
      .where(eq(oauthClients.id, id))
    return result[0].affectedRows > 0
  }

  async deleteExpiredIncompleteClients(
    registeredBefore: Date
  ): Promise<number> {
    const result = await this.db.delete(oauthClients).where(
      and(
        // Only `dcr`: those are the rows an anonymous caller creates, and
        // Claude creates a fresh one per connection.
        eq(oauthClients.registrationType, 'dcr'),
        isNull(oauthClients.completedAt),
        lt(oauthClients.createdAt, registeredBefore)
      )
    )
    return result[0].affectedRows
  }
}
