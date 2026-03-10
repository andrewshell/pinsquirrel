import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/mysql-core'
import { users } from './users'

export const pins = mysqlTable(
  'pins',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    urlHash: varchar('url_hash', { length: 32 }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    readLater: boolean('read_later').default(false).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
  },
  table => ({
    userIdUrlHashIdx: uniqueIndex('pins_user_id_url_hash_idx').on(
      table.userId,
      table.urlHash
    ),
  })
)
