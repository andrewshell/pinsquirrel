import {
  mysqlTable,
  varchar,
  timestamp,
  primaryKey,
} from 'drizzle-orm/mysql-core'
import { users } from './users'

export const userRoles = mysqlTable(
  'user_roles',
  {
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.userId, table.role] }),
  })
)
