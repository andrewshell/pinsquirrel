import type {
  CreateEmailChangeData,
  EmailChange,
  EmailChangeRepository,
} from '@pinsquirrel/domain'
import { and, eq, gt } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { emailChanges } from '../schema/email-changes.js'

export class DrizzleEmailChangeRepository implements EmailChangeRepository {
  constructor(private db: MySql2Database) {}

  async save(data: CreateEmailChangeData): Promise<void> {
    const row = { id: crypto.randomUUID(), createdAt: new Date(), ...data }
    await this.db
      .insert(emailChanges)
      .values(row)
      .onDuplicateKeyUpdate({ set: row })
  }

  async consume(tokenHash: string): Promise<EmailChange | null> {
    const now = new Date()
    const [change] = await this.db
      .select()
      .from(emailChanges)
      .where(
        and(
          eq(emailChanges.tokenHash, tokenHash),
          gt(emailChanges.expiresAt, now)
        )
      )
      .limit(1)
    if (!change) return null

    const result = await this.db
      .delete(emailChanges)
      .where(
        and(eq(emailChanges.id, change.id), gt(emailChanges.expiresAt, now))
      )
    return result[0].affectedRows === 1 ? change : null
  }
}
