import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { coreColumns } from './common';

export const usersTable = sqliteTable('users', {
  ...coreColumns(),
  email: text().notNull().unique(),
  password: text().notNull(),
});
