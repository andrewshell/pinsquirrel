import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'

export const pins = pgTable('pins', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  readLater: boolean('read_later').default(false).notNull(),
  contentPath: text('content_path'),
  imagePath: text('image_path'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
