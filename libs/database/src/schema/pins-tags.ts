import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core'
import { pins } from './pins'
import { tags } from './tags'

export const pinsTags = pgTable(
  'pins_tags',
  {
    pinId: text('pin_id')
      .notNull()
      .references(() => pins.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  table => ({
    pk: primaryKey({ columns: [table.pinId, table.tagId] }),
  })
)
