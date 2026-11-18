import type {
  OAuthToken,
  CreateOAuthTokenData,
  IssuedTokenData,
  OAuthTokenRepository,
} from '@pinsquirrel/domain'
import { and, eq, gt, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { oauthTokens } from '../schema/oauth-tokens'
import {
  holdUserWhileIssuing,
  revokeUserTokens,
  insertTokens,
} from './oauth-issuance'

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

  async create(data: CreateOAuthTokenData): Promise<OAuthToken> {
    const [id] = await insertTokens(this.db, [data])

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
    return this.db.transaction(tx =>
      revokeUserTokens(tx, userId, eq(oauthTokens.clientId, clientId))
    )
  }

  async revokeByGrant(userId: string, grantId: string): Promise<number> {
    return this.db.transaction(tx =>
      revokeUserTokens(tx, userId, eq(oauthTokens.grantId, grantId))
    )
  }

  async rotate(tokenId: string, successors: IssuedTokenData): Promise<boolean> {
    const [{ userId, grantId }] = successors

    return this.db.transaction(async tx => {
      if (!(await holdUserWhileIssuing(tx, userId))) {
        return false
      }

      const result = await tx
        .update(oauthTokens)
        .set({
          rotatedAt: new Date(),
          grantId: sql`coalesce(${oauthTokens.grantId}, ${grantId})`,
        })
        .where(
          and(
            eq(oauthTokens.id, tokenId),
            isNull(oauthTokens.rotatedAt),
            isNull(oauthTokens.revokedAt)
          )
        )
      if (result[0].affectedRows === 0) {
        return false
      }

      await insertTokens(tx, successors)
      return true
    })
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.db
      .delete(oauthTokens)
      .where(
        or(
          lt(oauthTokens.expiresAt, new Date()),
          isNotNull(oauthTokens.revokedAt)
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
