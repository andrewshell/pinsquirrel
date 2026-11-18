import type {
  CreateEmailChangeData,
  EmailChangeRepository,
} from '@pinsquirrel/domain'
import { and, eq, gt, TransactionRollbackError } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { emailChanges } from '../schema/email-changes.js'
import { passwordResetTokens } from '../schema/password-reset-tokens.js'
import { users } from '../schema/users.js'
import { writeOrConflict } from './deadlock.js'
import { isDuplicateKeyError } from './duplicate-key.js'

export class DrizzleEmailChangeRepository implements EmailChangeRepository {
  constructor(private db: MySql2Database) {}

  async save(data: CreateEmailChangeData): Promise<void> {
    const row = { id: crypto.randomUUID(), createdAt: new Date(), ...data }
    await this.db
      .insert(emailChanges)
      .values(row)
      .onDuplicateKeyUpdate({ set: row })
  }

  async confirm(tokenHash: string): Promise<boolean> {
    try {
      await writeOrConflict(() =>
        this.db.transaction(async tx => {
          const now = new Date()
          const [change] = await tx
            .select()
            .from(emailChanges)
            .where(
              and(
                eq(emailChanges.tokenHash, tokenHash),
                gt(emailChanges.expiresAt, now)
              )
            )
            .limit(1)
          if (!change) tx.rollback()

          await tx
            .update(users)
            .set({
              emailHash: change.emailHash,
              emailEncrypted: change.emailEncrypted,
              updatedAt: now,
            })
            .where(eq(users.id, change.userId))
          const [spent] = await tx
            .delete(emailChanges)
            .where(
              and(
                eq(emailChanges.id, change.id),
                gt(emailChanges.expiresAt, now)
              )
            )
          if (spent.affectedRows !== 1) tx.rollback()
          await tx
            .delete(passwordResetTokens)
            .where(eq(passwordResetTokens.userId, change.userId))
        })
      )
      return true
    } catch (error) {
      if (error instanceof TransactionRollbackError) return false
      if (isDuplicateKeyError(error)) return false
      throw error
    }
  }
}
