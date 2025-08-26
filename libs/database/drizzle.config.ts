import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

// SSL configuration is handled via DATABASE_URL parameters:
// - Development: postgresql://user:pass@localhost:5432/db (no SSL)
// - Production: postgresql://user:pass@host:port/db?sslmode=require (SSL required)
// 
// For self-signed certificates in production, set:
// NODE_TLS_REJECT_UNAUTHORIZED=0

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel',
  },
})
