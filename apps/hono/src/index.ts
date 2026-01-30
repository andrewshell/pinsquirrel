import { serve } from '@hono/node-server'
import { app } from './app.js'

const port = Number(process.env.PORT) || 3001

console.log(`Starting Hono server on port ${port}...`)

serve({
  fetch: app.fetch,
  port,
})

console.log(`Hono server is running at http://localhost:${port}`)
