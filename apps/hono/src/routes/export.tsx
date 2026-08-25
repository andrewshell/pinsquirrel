import { Hono } from 'hono'
import { AccessControl } from '@pinsquirrel/domain'
import { pinboardService } from '../lib/services'
import { getAuthUser, requireAuth } from '../middleware/session'

const exportRoute = new Hono()

// Apply auth middleware
exportRoute.use('*', requireAuth())

// GET /export/pinboard.json - Export pins in Pinboard format
exportRoute.get('/pinboard.json', async c => {
  const user = getAuthUser(c)

  const pins = await pinboardService.exportPins(new AccessControl(user))

  const today = new Date().toISOString().split('T')[0]

  return c.body(JSON.stringify(pins, null, 2), 200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="pinsquirrel_export_${today}.json"`,
  })
})

export { exportRoute as exportRoutes }
