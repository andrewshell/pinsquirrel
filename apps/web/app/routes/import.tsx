import { useActionData, Form, data, useNavigation } from 'react-router'
import type { Route } from './+types/import'
import { requireAccessControl, setFlashMessage } from '~/lib/session.server'
import { pinService, pinRepository } from '~/lib/services/container.server'
import { DuplicatePinError } from '@pinsquirrel/domain'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { ArrowLeft, Upload, AlertCircle, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { logger } from '~/lib/logger.server'

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

interface ImportResult {
  success: boolean
  message: string
  stats?: {
    imported: number
    tags: number
  }
}

export function meta(_: Route.MetaArgs) {
  return [
    {
      title: 'Import Bookmarks - PinSquirrel',
    },
    {
      name: 'description',
      content: 'Import your bookmarks from Pinboard to PinSquirrel.',
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAccessControl(request)

  return data({})
}

export async function action({ request }: Route.ActionArgs) {
  const ac = await requireAccessControl(request)

  try {
    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return data<ImportResult>(
        { success: false, message: 'Please select a file to import' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.json')) {
      return data<ImportResult>(
        { success: false, message: 'Please upload a JSON file' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return data<ImportResult>(
        { success: false, message: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Read and parse the file
    const fileContent = await file.text()
    let pinboardData: PinboardPin[] = []

    try {
      pinboardData = JSON.parse(fileContent) as PinboardPin[]
    } catch (error) {
      logger.error('Failed to parse JSON file', { error })
      return data<ImportResult>(
        { success: false, message: 'Invalid JSON file format' },
        { status: 400 }
      )
    }

    // Validate it's a Pinboard export (check for expected fields)
    if (!Array.isArray(pinboardData) || pinboardData.length === 0) {
      return data<ImportResult>(
        {
          success: false,
          message: 'File does not appear to be a valid Pinboard export',
        },
        { status: 400 }
      )
    }

    const firstPin = pinboardData[0]
    if (!firstPin.href || !firstPin.description || !firstPin.time) {
      return data<ImportResult>(
        {
          success: false,
          message: 'File structure does not match Pinboard export format',
        },
        { status: 400 }
      )
    }

    logger.info(`Starting Pinboard import for user ${ac.user!.username}`, {
      userId: ac.user!.id,
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
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)

        tagNames.forEach(tag => allTagNames.add(tag))

        // Prepare title: use URL if blank, truncate if over 200 characters
        let title = pinboardPin.description?.trim() || ''
        if (!title) {
          title = pinboardPin.href
        }
        if (title.length > 200) {
          title = title.substring(0, 200)
        }

        // Prepare description: truncate if over 1000 characters
        let description = pinboardPin.extended || null
        if (description && description.length > 1000) {
          description = description.substring(0, 1000)
        }

        // Create pin using the service with original timestamp
        await pinService.createPin(ac, {
          userId: ac.user!.id,
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
                // Use repository method to update createdAt (special case for import)
                await pinRepository.updateCreatedAt(
                  error.existingPin.id,
                  pinboardTimestamp
                )

                logger.info(
                  `Updated createdAt for duplicate pin from ${error.existingPin.createdAt.toISOString()} to ${pinboardTimestamp.toISOString()}: ${pinboardPin.href}`
                )
              }
            } catch (updateError) {
              logger.error(
                `Failed to update duplicate pin: ${pinboardPin.href}`,
                {
                  error: updateError,
                }
              )
            }
          }

          skippedCount++
          logger.debug(`Skipped duplicate pin: ${pinboardPin.href}`)
        } else {
          logger.error(`Failed to import pin: ${pinboardPin.href}`, { error })
          // Continue with next pin instead of failing entire import
        }
      }
    }

    logger.info(`Completed Pinboard import for user ${ac.user!.username}`, {
      userId: ac.user!.id,
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

    // Set success message and redirect
    return setFlashMessage(request, 'success', successMessage, '/pins')
  } catch (error) {
    logger.error('Import failed with unexpected error', {
      error,
      userId: ac.user!.id,
    })
    return data<ImportResult>(
      { success: false, message: 'An unexpected error occurred during import' },
      { status: 500 }
    )
  }
}

export default function ImportRoute() {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()

  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to="/pins"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Pins
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Import from Pinboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-sm text-muted-foreground">
            <p>
              Upload your Pinboard export file to import all your bookmarks into
              PinSquirrel.
            </p>
            <p>To export from Pinboard:</p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Go to Pinboard Settings</li>
              <li>Click on &quot;Backup&quot; in the menu</li>
              <li>Download the JSON format export</li>
              <li>Upload the file below</li>
            </ol>
          </div>

          {actionData && !actionData.success && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import Failed</AlertTitle>
              <AlertDescription>{actionData.message}</AlertDescription>
            </Alert>
          )}

          <Form
            method="post"
            encType="multipart/form-data"
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="file">Pinboard Export File</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".json,application/json"
                required
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                Select your pinboard_export.json file (max 10MB)
              </p>
            </div>

            <div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Import Bookmarks
                  </>
                )}
              </Button>
            </div>
          </Form>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>
              This import will add new pins to your collection. Existing pins
              will not be affected. Duplicate URLs will be skipped.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
