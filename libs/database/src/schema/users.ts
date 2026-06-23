import {
  mysqlTable,
  varchar,
  timestamp,
  mysqlEnum,
} from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  emailHash: varchar('email_hash', { length: 255 }),
  status: mysqlEnum('status', ['unverified', 'waitlist', 'active'])
    .default('unverified')
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', fsp: 3 })
    .defaultNow()
    .notNull(),
})
