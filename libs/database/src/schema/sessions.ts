import {
  mysqlTable,
  varchar,
  timestamp,
  json,
  index,
} from 'drizzle-orm/mysql-core'
import { users } from './users'

export const sessions = mysqlTable(
  'sessions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    data: json('data').$type<Record<string, unknown> | null>(),
    expiresAt: timestamp('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
  },
  table => ({
    // The scheduled sweep deletes on `expires_at < now` across the whole
    // table; without this it scans every session on every run.
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  })
)
