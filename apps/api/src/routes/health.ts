import { Hono } from 'hono'

const health = new Hono()

health.get('/health', c => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

health.get('/health/ready', c => {
  return c.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  })
})

export default health
