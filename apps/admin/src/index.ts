import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { loadConfig } from './config.js'

const app = createApp(loadConfig())
const port = Number(process.env.PORT) || 8200

serve({ fetch: app.fetch, port })

console.log(`PinSquirrel Admin running at http://localhost:${port}`)
