import {
  mysqlTable,
  varchar,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/mysql-core'
import { users } from './users'

export const tags = mysqlTable(
  'tags',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
  },
  table => ({
    userIdNameIdx: uniqueIndex('tags_user_id_name_idx').on(
      table.userId,
      table.name
    ),
  })
)
