import type { CreateOAuthTokenData } from '@pinsquirrel/domain'
import { eq } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { oauthTokens } from '../schema/oauth-tokens'
import { users } from '../schema/users'

type Transaction = Parameters<Parameters<MySql2Database['transaction']>[0]>[0]

/**
 * Issuing tokens and revoking them take turns on the user's row.
 *
 * A transaction that issues holds the row shared until its tokens are
 * committed. A revocation takes it exclusively before it touches a token. So
 * a revocation never runs through the middle of an issuance: it finishes
 * first, and the issuer's conditional write finds the code deleted or the
 * token revoked, or it starts after the commit and its statements see the
 * new rows. Without the lock, a revocation's scan can pass the place the new
 * rows are about to go.
 *
 * False when the user is gone.
 */
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

/** The revoking half of `holdUserWhileIssuing`. */
export async function holdUserWhileRevoking(
  tx: Transaction,
  userId: string
): Promise<void> {
  await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for('update')
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
