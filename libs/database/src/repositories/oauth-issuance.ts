import type { CreateOAuthTokenData } from '@pinsquirrel/domain'
import { and, eq, isNull, type SQL } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { oauthTokens } from '../schema/oauth-tokens'
import { users } from '../schema/users'

type Transaction = Parameters<Parameters<MySql2Database['transaction']>[0]>[0]

export async function holdUserWhileIssuing(
  tx: Transaction,
  userId: string
): Promise<boolean> {
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for('share')
  return user !== undefined
}

export async function revokeUserTokens(
  tx: Transaction,
  userId: string,
  which?: SQL
): Promise<number> {
  await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for('update')
  const result = await tx
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(oauthTokens.userId, userId), which, isNull(oauthTokens.revokedAt))
    )
  return result[0].affectedRows
}

export async function insertTokens(
  tx: Transaction | MySql2Database,
  tokens: CreateOAuthTokenData[]
): Promise<string[]> {
  const now = new Date()
  const rows = tokens.map(data => ({
    id: crypto.randomUUID(),
    tokenHash: data.tokenHash,
    kind: data.kind,
    clientId: data.clientId,
    userId: data.userId,
    scopes: data.scopes,
    resource: data.resource,
    grantId: data.grantId,
    expiresAt: data.expiresAt,
    revokedAt: null,
    rotatedAt: null,
    rotatedFrom: data.rotatedFrom ?? null,
    createdAt: now,
  }))
  await tx.insert(oauthTokens).values(rows)
  return rows.map(row => row.id)
}
