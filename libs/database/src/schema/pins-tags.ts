import { mysqlTable, varchar, primaryKey } from 'drizzle-orm/mysql-core'
import { pins } from './pins'
import { tags } from './tags'

export const pinsTags = mysqlTable(
  'pins_tags',
  {
    pinId: varchar('pin_id', { length: 36 })
      .notNull()
      .references(() => pins.id, { onDelete: 'cascade' }),
    tagId: varchar('tag_id', { length: 36 })
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  table => ({
    pk: primaryKey({ columns: [table.pinId, table.tagId] }),
  })
)
