import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema/index.js'

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/pinsquirrel'

const pool = new Pool({
  connectionString
})

export const db = drizzle(pool, { schema })