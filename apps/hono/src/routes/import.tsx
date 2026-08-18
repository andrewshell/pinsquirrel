import { Hono } from 'hono'
import { AccessControl } from '@pinsquirrel/domain'
import {
  InvalidPinboardExportError,
  PinboardService,
  type InvalidPinboardExportReason,
} from '@pinsquirrel/services'
import { pinboardService } from '../lib/services'
import {
  getAuthUser,
  getSessionManager,
  requireAuth,
} from '../middleware/session'
import { ImportPage } from '../views/pages/import'
import { logger, safeError } from '../lib/logger.js'

/** Uploads above this never reach the parser. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const PARSE_ERRORS: Record<InvalidPinboardExportReason, string> = {
  'malformed-json': 'Invalid JSON file format',
  'not-a-list': 'File does not appear to be a valid Pinboard export',
  'wrong-shape': 'File structure does not match Pinboard export format',
}

/** Describe the outcome the way the flash message has always phrased it. */
function summarise(
  imported: number,
  skipped: number,
  tagCount: number
): string {
  const duplicates =
    skipped > 0
      ? ` (skipped ${skipped} duplicate${skipped === 1 ? '' : 's'})`
      : ''
  return `Successfully imported ${imported} pins${duplicates} with ${tagCount} unique tags`
}

const importRoute = new Hono()

// Apply auth middleware
importRoute.use('*', requireAuth())

// GET /import - Show import form
importRoute.get('/', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = getAuthUser(c)

  const flash = sessionManager.getFlash()

  return c.html(<ImportPage user={user} flash={flash} />)
})

// POST /import - Process import
importRoute.post('/', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = getAuthUser(c)

  const ac = new AccessControl(user)

  const fail = (message: string, status?: 500) =>
    c.html(
      <ImportPage user={user} errors={{ _form: [message] }} />,
      ...(status ? ([status] as const) : ([] as const))
    )

  try {
    const formData = await c.req.parseBody()
    const file = formData.file

    if (!file || !(file instanceof File)) {
      return fail('Please select a file to import')
    }
    if (!file.name.endsWith('.json')) {
      return fail('Please upload a JSON file')
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return fail('File size exceeds 10MB limit')
    }

    let pins
    try {
      pins = PinboardService.parse(await file.text())
    } catch (error) {
      if (error instanceof InvalidPinboardExportError) {
        return fail(PARSE_ERRORS[error.reason])
      }
      throw error
    }

    logger.info(
      { userId: user.id, pinCount: pins.length },
      'Pinboard import started'
    )

    const result = await pinboardService.importPins(
      ac,
      user.id,
      pins,
      (error) =>
        logger.error(
          { userId: user.id, err: safeError(error) },
          'Failed to import pin'
        )
    )

    logger.info(
      {
        userId: user.id,
        imported: result.imported,
        skipped: result.skipped,
        total: pins.length,
        tags: result.tagNames.size,
      },
      'Pinboard import completed'
    )

    sessionManager.setFlash(
      'success',
      summarise(result.imported, result.skipped, result.tagNames.size)
    )
    return c.redirect('/pins')
  } catch (error) {
    logger.error(
      { userId: user.id, err: safeError(error) },
      'Import failed with unexpected error'
    )
    return fail('An unexpected error occurred during import', 500)
  }
})

export { importRoute as importRoutes }
