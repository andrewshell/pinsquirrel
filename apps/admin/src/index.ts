import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.js'

const port = Number(process.env.PORT) || 8200

serve({ fetch: app.fetch, port })

console.log(`PinSquirrel Admin running at http://localhost:${port}`)
