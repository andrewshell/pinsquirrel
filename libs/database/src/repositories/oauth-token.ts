import type {
  OAuthToken,
  CreateOAuthTokenData,
  OAuthTokenRepository,
} from '@pinsquirrel/domain'
import { and, eq, gt, isNotNull, isNull, lt, or } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { oauthTokens } from '../schema/oauth-tokens'

export class DrizzleOAuthTokenRepository implements OAuthTokenRepository {
  constructor(private db: MySql2Database) {}

  async findById(id: string): Promise<OAuthToken | null> {
    const result = await this.db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.id, id))
      .limit(1)
    return result[0] || null
  }

  async findByTokenHash(tokenHash: string): Promise<OAuthToken | null> {
    const result = await this.db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.tokenHash, tokenHash))
      .limit(1)
    return result[0] || null
  }

  async findActiveByUserId(userId: string): Promise<OAuthToken[]> {
    return await this.db
      .select()
      .from(oauthTokens)
      .where(and(eq(oauthTokens.userId, userId), this.stillLive()))
  }

  async findByRotatedFrom(tokenId: string): Promise<OAuthToken | null> {
    const result = await this.db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.rotatedFrom, tokenId))
      .limit(1)
    return result[0] || null
  }

  async create(data: CreateOAuthTokenData): Promise<OAuthToken> {
    const id = crypto.randomUUID()
    const now = new Date()

    await this.db.insert(oauthTokens).values({
      id,
      tokenHash: data.tokenHash,
      kind: data.kind,
      clientId: data.clientId,
      userId: data.userId,
      scopes: data.scopes,
      resource: data.resource,
      expiresAt: data.expiresAt,
      revokedAt: null,
      rotatedAt: null,
      rotatedFrom: data.rotatedFrom ?? null,
      createdAt: now,
    })

    const [created] = await this.db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.id, id))
      .limit(1)

    return created
  }

  async revoke(id: string): Promise<boolean> {
    const result = await this.db
      .update(oauthTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(oauthTokens.id, id), isNull(oauthTokens.revokedAt)))
    return result[0].affectedRows > 0
  }

  async revokeByUserAndClient(
    userId: string,
    clientId: string
  ): Promise<number> {
    const result = await this.db
      .update(oauthTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(oauthTokens.userId, userId),
          eq(oauthTokens.clientId, clientId),
          isNull(oauthTokens.revokedAt)
        )
      )
    return result[0].affectedRows
  }

  async markRotated(id: string): Promise<boolean> {
    const result = await this.db
      .update(oauthTokens)
      .set({ rotatedAt: new Date() })
      .where(and(eq(oauthTokens.id, id), isNull(oauthTokens.rotatedAt)))
    return result[0].affectedRows > 0
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.db
      .delete(oauthTokens)
      .where(
        or(
          lt(oauthTokens.expiresAt, new Date()),
          isNotNull(oauthTokens.revokedAt),
          isNotNull(oauthTokens.rotatedAt)
        )
      )
    return result[0].affectedRows
  }

  /** Not expired, not revoked, not already exchanged for a successor. */
  private stillLive() {
    return and(
      gt(oauthTokens.expiresAt, new Date()),
      isNull(oauthTokens.revokedAt),
      isNull(oauthTokens.rotatedAt)
    )
  }
}
