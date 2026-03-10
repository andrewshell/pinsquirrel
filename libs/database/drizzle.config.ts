import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './src/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel',
  },
})
