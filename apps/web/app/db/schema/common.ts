import { integer } from 'drizzle-orm/sqlite-core';

export function createdAtUpdatedAtColumns() {
  return {
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(
      () => new Date()
    ),
  };
}

export function coreColumns() {
  return {
    ...createdAtUpdatedAtColumns(),
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  };
}
