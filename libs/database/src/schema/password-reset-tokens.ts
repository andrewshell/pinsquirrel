import { mysqlTable, varchar, timestamp, index } from 'drizzle-orm/mysql-core'
import { users } from './users'

export const passwordResetTokens = mysqlTable(
  'password_reset_tokens',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
  },
  table => ({
    // Same sweep, same reason as sessions_expires_at_idx.
    expiresAtIdx: index('password_reset_tokens_expires_at_idx').on(
      table.expiresAt
    ),
  })
)
