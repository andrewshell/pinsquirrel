import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db } from '../lib/db.js'

const healthRoutes = new Hono()

healthRoutes.get('/', async (c) => {
  let database: 'connected' | 'disconnected' = 'disconnected'
  let error: string | undefined

  try {
    const result = await db.execute(sql`SELECT 1 as health_check`)
    if (Array.isArray(result[0]) && result[0].length > 0) {
      database = 'connected'
    }
  } catch (e) {
    console.error('[HEALTH] DB check failed:', e)
    error = 'database unavailable'
  }

  const status = database === 'connected' ? 'ok' : 'degraded'

  return c.json(
    {
      status,
      database,
      ...(error ? { error } : {}),
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    status === 'ok' ? 200 : 503
  )
})

export { healthRoutes }
