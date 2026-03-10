import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { AccessControl } from '@pinsquirrel/domain'
import type { Pin } from '@pinsquirrel/domain'
import { pinService } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'

function md5(input: string): string {
  return createHash('md5').update(input).digest('hex')
}

function formatPinboardTime(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z')
}

function pinboardHash(pin: Pin): string {
  return md5(pin.url)
}

function pinboardMeta(pin: Pin): string {
  return md5(
    [
      pin.url,
      pin.title,
      pin.description ?? '',
      pin.tagNames.join(' '),
      pin.readLater ? 'yes' : 'no',
    ].join('\n')
  )
}

const exportRoute = new Hono()

// Apply auth middleware
exportRoute.use('*', requireAuth())

// GET /export/pinboard.json - Export pins in Pinboard format
exportRoute.get('/pinboard.json', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const ac = new AccessControl(user)
  const pins = await pinService.getUserPins(ac)

  const pinboardData = pins.map((pin) => ({
    href: pin.url,
    description: pin.title,
    extended: pin.description ?? '',
    meta: pinboardMeta(pin),
    hash: pinboardHash(pin),
    time: formatPinboardTime(pin.createdAt),
    shared: 'no',
    toread: pin.readLater ? 'yes' : 'no',
    tags: pin.tagNames.join(' '),
  }))

  const today = new Date().toISOString().split('T')[0]
  const body = JSON.stringify(pinboardData, null, 2)

  return c.body(body, 200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="pinsquirrel_export_${today}.json"`,
  })
})

export { exportRoute as exportRoutes }
