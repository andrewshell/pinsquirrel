import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel'
  }
})