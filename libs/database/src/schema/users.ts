import {
  mysqlTable,
  varchar,
  timestamp,
  mysqlEnum,
  text,
  uniqueIndex,
} from 'drizzle-orm/mysql-core'

export const users = mysqlTable(
  'users',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }),
    emailHash: varchar('email_hash', { length: 255 }),
    emailEncrypted: text('email_encrypted'),
    status: mysqlEnum('status', ['unverified', 'waitlist', 'active'])
      .default('unverified')
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
  },
  table => ({
    // findByEmailHash runs on every signup and every password-reset request,
    // both driveable by an unauthenticated caller, and was a full table scan.
    //
    // Unique rather than plain: one account per email is the rule the
    // registration flow already tries to enforce with a check-then-insert, and
    // only the constraint closes the race between the two. MySQL does not
    // constrain NULLs, so accounts without an email are unaffected.
    emailHashIdx: uniqueIndex('users_email_hash_idx').on(table.emailHash),
  })
)
