import type { CreateOAuthTokenData } from '@pinsquirrel/domain'
import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import {
  OAUTH_TOKENS_USER_CLIENT_INDEX,
  oauthTokens,
} from '../schema/oauth-tokens'
import { users } from '../schema/users'
import { isDeadlockError, retryOnDeadlock } from './deadlock'

type Transaction = Parameters<Parameters<MySql2Database['transaction']>[0]>[0]

/**
 * Rows a statement names by primary key at a time. With FORCE INDEX
 * (PRIMARY) such a statement locks those rows and no gap between them.
 */
export const PRIMARY_KEY_BATCH = 500

export function inBatches<T>(items: T[]): T[][] {
  const batches: T[][] = []
  for (let start = 0; start < items.length; start += PRIMARY_KEY_BATCH) {
    batches.push(items.slice(start, start + PRIMARY_KEY_BATCH))
  }
  return batches
}

/** Run a raw UPDATE or DELETE and report how many rows it changed. */
export async function changedRows(
  db: Transaction | MySql2Database,
  statement: SQL
): Promise<number> {
  const [result] = await db.execute(statement)
  return 'affectedRows' in result ? result.affectedRows : 0
}

/**
 * Run a transaction that issues a code or tokens. One that loses a deadlock
 * runs again from the start, and one that loses twice answers `refused`,
 * which is what its caller already gets for a lost race. Nothing was written
 * either time. PLAN.md decision 41.
 */
export async function issueOrRefuse<T>(
  issue: () => Promise<T>,
  refused: T
): Promise<T> {
  try {
    return await retryOnDeadlock(issue)
  } catch (error) {
    if (isDeadlockError(error)) {
      return refused
    }
    throw error
  }
}

export async function holdUserWhileIssuing(
  tx: Transaction,
  userId: string
): Promise<boolean> {
  // Shared, so issuances run together, and held to the commit, so a
  // revocation of this user waits for the rows being written here. PLAN.md
  // decision 41.
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
  // Exclusive, so every issuance for this user has committed or has not
  // started, and the read below sees all of the user's tokens. PLAN.md
  // decision 41.
  await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for('update')

  // Read through the user's index and stamped by primary key: left to the
  // optimizer, one UPDATE can scan the whole table and lock the gaps other
  // users' new tokens go into.
  const live = await tx
    .select({ id: oauthTokens.id })
    .from(oauthTokens, { forceIndex: OAUTH_TOKENS_USER_CLIENT_INDEX })
    .where(
      and(eq(oauthTokens.userId, userId), which, isNull(oauthTokens.revokedAt))
    )
    .for('update')

  const revokedAt = sql.param(new Date(), oauthTokens.revokedAt)
  let revoked = 0
  for (const batch of inBatches(live.map(row => row.id))) {
    revoked += await changedRows(
      tx,
      sql`update ${oauthTokens} force index (primary) set ${sql.identifier('revoked_at')} = ${revokedAt} where ${inArray(oauthTokens.id, batch)}`
    )
  }
  return revoked
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
    grantedAt: data.grantedAt,
    expiresAt: data.expiresAt,
    revokedAt: null,
    rotatedAt: null,
    rotatedFrom: data.rotatedFrom ?? null,
    createdAt: now,
  }))
  await tx.insert(oauthTokens).values(rows)
  return rows.map(row => row.id)
}
