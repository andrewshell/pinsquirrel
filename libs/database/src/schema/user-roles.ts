import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './users'

export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.userId, table.role] }),
  })
)
