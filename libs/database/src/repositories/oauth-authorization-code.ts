import type {
  AuthorizationCode,
  CodeExchangeOutcome,
  CreateAuthorizationCodeData,
  IssuedTokenData,
  OAuthAuthorizationCodeRepository,
} from '@pinsquirrel/domain'
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { oauthAuthorizationCodes } from '../schema/oauth-authorization-codes'
import { sessions } from '../schema/sessions'
import {
  holdUserWhileIssuing,
  insertTokens,
  issueOrRefuse,
} from './oauth-issuance'

export class DrizzleOAuthAuthorizationCodeRepository implements OAuthAuthorizationCodeRepository {
  constructor(private db: MySql2Database) {}

  async findById(id: string): Promise<AuthorizationCode | null> {
    const result = await this.db
      .select()
      .from(oauthAuthorizationCodes)
      .where(eq(oauthAuthorizationCodes.id, id))
      .limit(1)
    return result[0] || null
  }

  async findByCodeHash(codeHash: string): Promise<AuthorizationCode | null> {
    const result = await this.db
      .select()
      .from(oauthAuthorizationCodes)
      .where(eq(oauthAuthorizationCodes.codeHash, codeHash))
      .limit(1)
    return result[0] || null
  }

  async create(
    data: CreateAuthorizationCodeData,
    sessionId: string
  ): Promise<AuthorizationCode | null> {
    const id = crypto.randomUUID()

    const creation = () =>
      this.db.transaction(async tx => {
        const [session] = await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(
            and(eq(sessions.id, sessionId), eq(sessions.userId, data.userId))
          )
          .for('share')
        if (!session) {
          return null
        }

        await tx.insert(oauthAuthorizationCodes).values({
          id,
          codeHash: data.codeHash,
          clientId: data.clientId,
          userId: data.userId,
          redirectUri: data.redirectUri,
          codeChallenge: data.codeChallenge,
          scopes: data.scopes,
          resource: data.resource,
          grantId: data.grantId,
          expiresAt: data.expiresAt,
          consumedAt: null,
          createdAt: new Date(),
        })

        const [created] = await tx
          .select()
          .from(oauthAuthorizationCodes)
          .where(eq(oauthAuthorizationCodes.id, id))
          .limit(1)
        return created
      })

    return issueOrRefuse(creation, null)
  }

  async exchange(
    codeId: string,
    tokens: IssuedTokenData
  ): Promise<CodeExchangeOutcome> {
    const [{ userId }] = tokens

    const exchange = () =>
      this.db.transaction(async tx => {
        if (!(await holdUserWhileIssuing(tx, userId))) {
          return 'gone'
        }

        const now = new Date()
        const result = await tx
          .update(oauthAuthorizationCodes)
          .set({ consumedAt: now })
          .where(
            and(
              eq(oauthAuthorizationCodes.id, codeId),
              isNull(oauthAuthorizationCodes.consumedAt),
              gt(oauthAuthorizationCodes.expiresAt, now)
            )
          )
        if (result[0].affectedRows === 0) {
          const [code] = await tx
            .select({ consumedAt: oauthAuthorizationCodes.consumedAt })
            .from(oauthAuthorizationCodes)
            .where(eq(oauthAuthorizationCodes.id, codeId))
          return code?.consumedAt ? 'spent' : 'gone'
        }

        await insertTokens(tx, tokens)
        return 'exchanged'
      })

    return issueOrRefuse(exchange, 'gone')
  }

  async consume(codeHash: string): Promise<AuthorizationCode | null> {
    const now = new Date()

    // One statement, not a read followed by a write: the row lock this UPDATE
    // takes is what makes two concurrent exchanges of the same code resolve to
    // one winner. `affectedRows` is 1 only for the call that found the code
    // unspent and unexpired.
    const result = await this.db
      .update(oauthAuthorizationCodes)
      .set({ consumedAt: now })
      .where(
        and(
          eq(oauthAuthorizationCodes.codeHash, codeHash),
          isNull(oauthAuthorizationCodes.consumedAt),
          gt(oauthAuthorizationCodes.expiresAt, now)
        )
      )

    if (result[0].affectedRows === 0) {
      return null
    }

    return await this.findByCodeHash(codeHash)
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(oauthAuthorizationCodes)
      .where(eq(oauthAuthorizationCodes.id, id))
    return result[0].affectedRows > 0
  }

  async deleteExpiredCodes(): Promise<number> {
    const result = await this.db
      .delete(oauthAuthorizationCodes)
      .where(lt(oauthAuthorizationCodes.expiresAt, new Date()))
    return result[0].affectedRows
  }
}
