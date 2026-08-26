import { Hono } from 'hono'
import { mcpAuth } from '../mcp/auth.js'
import { mcpTransport } from '../mcp/server.js'
import { oauthConfig } from '../lib/config.js'

const mcpRoute = new Hono()

mcpRoute.use('*', mcpAuth(oauthConfig.resources.mcp))

mcpRoute.all('/', async c => {
  return mcpTransport.handleRequest(c)
})

export { mcpRoute as mcpRoutes }
