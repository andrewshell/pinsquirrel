import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { loadConfig } from './config.js'

const app = createApp(loadConfig())
const port = Number(process.env.PORT) || 8200

// Loopback by default. This console holds production database credentials and
// an unlocked private key, so it should not answer the network unless someone
// deliberately says so — `ADMIN_HOST=0.0.0.0` for a real deployment behind a
// reverse proxy that terminates TLS and does its own access control.
const hostname = process.env.ADMIN_HOST ?? '127.0.0.1'

serve({ fetch: app.fetch, port, hostname })

console.log(`PinSquirrel Admin running at http://${hostname}:${port}`)
