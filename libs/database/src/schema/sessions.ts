import { mysqlTable, varchar, timestamp, json } from 'drizzle-orm/mysql-core'
import { users } from './users'

export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  data: json('data').$type<Record<string, unknown> | null>(),
  expiresAt: timestamp('expires_at', { mode: 'date', fsp: 3 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
    .defaultNow()
    .notNull(),
})
