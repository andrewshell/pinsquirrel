import { Hono } from 'hono'
import { AccessControl, DuplicatePinError } from '@pinsquirrel/domain'
import { pinService, pinRepository } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'
import { ImportPage } from '../views/pages/import'

interface PinboardPin {
  href: string
  description: string
  extended: string
  meta: string
  hash: string
  time: string
  shared: string
  toread: string
  tags: string
}

const importRoute = new Hono()

// Apply auth middleware
importRoute.use('*', requireAuth())

// GET /import - Show import form
importRoute.get('/', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const flash = sessionManager.getFlash()

  return c.html(<ImportPage user={user} flash={flash} />)
})

// POST /import - Process import
importRoute.post('/', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const ac = new AccessControl(user)

  try {
    // Parse multipart form data
    const formData = await c.req.parseBody()
    const file = formData.file

    // Check if file was provided
    if (!file || !(file instanceof File)) {
      return c.html(
        <ImportPage
          user={user}
          errors={{ _form: ['Please select a file to import'] }}
        />
      )
    }

    // Validate file type
    if (!file.name.endsWith('.json')) {
      return c.html(
        <ImportPage
          user={user}
          errors={{ _form: ['Please upload a JSON file'] }}
        />
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return c.html(
        <ImportPage
          user={user}
          errors={{ _form: ['File size exceeds 10MB limit'] }}
        />
      )
    }

    // Read and parse the file
    const fileContent = await file.text()
    let pinboardData: PinboardPin[] = []

    try {
      pinboardData = JSON.parse(fileContent) as PinboardPin[]
    } catch {
      return c.html(
        <ImportPage
          user={user}
          errors={{ _form: ['Invalid JSON file format'] }}
        />
      )
    }

    // Validate it's a Pinboard export (check for expected fields)
    if (!Array.isArray(pinboardData) || pinboardData.length === 0) {
      return c.html(
        <ImportPage
          user={user}
          errors={{
            _form: ['File does not appear to be a valid Pinboard export'],
          }}
        />
      )
    }

    const firstPin = pinboardData[0]
    if (!firstPin.href || !firstPin.description || !firstPin.time) {
      return c.html(
        <ImportPage
          user={user}
          errors={{
            _form: ['File structure does not match Pinboard export format'],
          }}
        />
      )
    }

    console.log(`Starting Pinboard import for user ${user.username}`, {
      userId: user.id,
      pinCount: pinboardData.length,
    })

    // Import the pins
    let importedCount = 0
    let skippedCount = 0
    const allTagNames = new Set<string>()

    for (const pinboardPin of pinboardData) {
      try {
        // Parse Pinboard timestamp
        const pinboardTimestamp = new Date(pinboardPin.time)

        // Parse tags from space-separated string
        const tagNames = pinboardPin.tags
          .split(' ')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)

        tagNames.forEach((tag) => allTagNames.add(tag))

        // Prepare title: use URL if blank, truncate if over 200 characters
        let title = pinboardPin.description?.trim() || ''
        if (!title) {
          title = pinboardPin.href
        }
        if (title.length > 200) {
          title = title.substring(0, 200)
        }

        // Prepare description: truncate if over 1000 characters
        let description: string | null = pinboardPin.extended || null
        if (description && description.length > 1000) {
          description = description.substring(0, 1000)
        }

        // Create pin using the service with original timestamp
        await pinService.createPin(ac, {
          userId: user.id,
          url: pinboardPin.href,
          title: title,
          description: description,
          readLater: pinboardPin.toread === 'yes',
          tagNames: tagNames,
          createdAt: pinboardTimestamp,
          updatedAt: pinboardTimestamp,
        })

        importedCount++
      } catch (error) {
        if (error instanceof DuplicatePinError) {
          // For duplicates, check if Pinboard timestamp is earlier
          if (error.existingPin) {
            try {
              const pinboardTimestamp = new Date(pinboardPin.time)

              // Update createdAt if Pinboard timestamp is earlier
              if (pinboardTimestamp < error.existingPin.createdAt) {
                await pinRepository.updateCreatedAt(
                  error.existingPin.id,
                  pinboardTimestamp
                )

                console.log(
                  `Updated createdAt for duplicate pin from ${error.existingPin.createdAt.toISOString()} to ${pinboardTimestamp.toISOString()}: ${pinboardPin.href}`
                )
              }
            } catch (updateError) {
              console.error(
                `Failed to update duplicate pin: ${pinboardPin.href}`,
                updateError
              )
            }
          }

          skippedCount++
          console.debug(`Skipped duplicate pin: ${pinboardPin.href}`)
        } else {
          console.error(`Failed to import pin: ${pinboardPin.href}`, error)
          // Continue with next pin instead of failing entire import
        }
      }
    }

    console.log(`Completed Pinboard import for user ${user.username}`, {
      userId: user.id,
      imported: importedCount,
      skipped: skippedCount,
      total: pinboardData.length,
      tags: allTagNames.size,
    })

    // Build success message with skipped count if applicable
    let successMessage = `Successfully imported ${importedCount} pins`
    if (skippedCount > 0) {
      successMessage += ` (skipped ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'})`
    }
    successMessage += ` with ${allTagNames.size} unique tags`

    // Set flash message and redirect to pins
    sessionManager.setFlash('success', successMessage)
    return c.redirect('/pins')
  } catch (error) {
    console.error('Import failed with unexpected error', error)
    return c.html(
      <ImportPage
        user={user}
        errors={{ _form: ['An unexpected error occurred during import'] }}
      />,
      500
    )
  }
})

export { importRoute as importRoutes }
