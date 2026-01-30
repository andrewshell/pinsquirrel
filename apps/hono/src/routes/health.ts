import { Hono } from 'hono'
import { createDatabaseClient } from '@pinsquirrel/database'
import { sql } from 'drizzle-orm'

const healthRoutes = new Hono()

// Basic health check
healthRoutes.get('/', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Health check with database connectivity test
healthRoutes.get('/db', async (c) => {
  try {
    const db = createDatabaseClient(
      process.env.DATABASE_URL ||
        'postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel'
    )

    // Simple query to test database connection
    const result = await db.execute(sql`SELECT 1 as health_check`)

    if (result.rows.length > 0) {
      return c.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      })
    }

    return c.json(
      {
        status: 'error',
        database: 'query failed',
        timestamp: new Date().toISOString(),
      },
      500
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return c.json(
      {
        status: 'error',
        database: 'disconnected',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      500
    )
  }
})

export { healthRoutes }
