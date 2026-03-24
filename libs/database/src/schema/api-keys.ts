import { mysqlTable, varchar, timestamp } from 'drizzle-orm/mysql-core'
import { users } from './users'

export const apiKeys = mysqlTable('api_keys', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 8 }).notNull(),
  lastUsedAt: timestamp('last_used_at', { mode: 'date', fsp: 3 }),
  expiresAt: timestamp('expires_at', { mode: 'date', fsp: 3 }),
  createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
    .defaultNow()
    .notNull(),
})
