import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import config from './app/lib/config';

export default defineConfig({
  out: './app/db/migrations',
  schema: './app/db/schema',
  dialect: 'sqlite',
  dbCredentials: {
    url: config.database.filename,
  },
});
