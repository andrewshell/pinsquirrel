import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

// SSL configuration
const getSSLConfig = () => {
  // Explicitly disable SSL if requested
  if (process.env.DATABASE_SSL === 'false') {
    return false
  }
  
  // In production, enable SSL by default
  // In development, disable SSL by default
  if (process.env.NODE_ENV === 'production') {
    // Note: For managed databases with self-signed certificates,
    // set DATABASE_SSL_MODE=no-verify in your environment
    return true
  }
  
  return false
}

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel',
    ssl: getSSLConfig(),
  },
})
