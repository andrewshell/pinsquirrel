import { mysqlTable, varchar, text, timestamp } from 'drizzle-orm/mysql-core'
import { users } from './users'

export const emailChanges = mysqlTable('email_changes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  emailHash: varchar('email_hash', { length: 255 }).notNull(),
  emailEncrypted: text('email_encrypted'),
  expiresAt: timestamp('expires_at', { mode: 'date', fsp: 3 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
    .defaultNow()
    .notNull(),
})
