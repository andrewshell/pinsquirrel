import { useLoaderData, useActionData, data } from 'react-router'
import type { Route } from './+types/pins.$id.edit'
import { requireUser, setFlashMessage } from '~/lib/session.server'
import { pinService, repositories } from '~/lib/services/container.server'
import { PinCreationForm } from '~/components/pins/PinCreationForm'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { validatePinDataUpdate, validateIdParam } from '@pinsquirrel/core'
import { parseFormData, parseParams } from '~/lib/http-utils'
import { useMetadataFetch } from '~/lib/useMetadataFetch'
import { logger } from '~/lib/logger.server'

// Pin creation form data type
export type PinCreationFormData = {
  url: string
  title: string
  description?: string
  readLater?: boolean
  tags?: string[]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Ensure user is authenticated
  const user = await requireUser(request)

  // Validate pin ID from params
  const paramData = parseParams(params)
  const pinIdResult = validateIdParam(paramData.id)

  if (!pinIdResult.success) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Invalid pin ID', { status: 404 })
  }

  // Fetch the pin using the service and user's existing tags for autocomplete
  try {
    const [pin, userTags] = await Promise.all([
      pinService.getPin(user.id, pinIdResult.data),
      repositories.tag.findByUserId(user.id),
    ])

    return data({
      pin,
      userTags: userTags.map(tag => tag.name),
    })
  } catch (error) {
    logger.exception(error, 'Failed to load pin for editing', {
      pinId: pinIdResult.data,
      userId: user.id,
    })

    // If pin not found or unauthorized, throw 404
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Pin not found', { status: 404 })
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  // Ensure user is authenticated
  const user = await requireUser(request)

  // Validate pin ID from params
  const paramData = parseParams(params)
  const pinIdResult = validateIdParam(paramData.id)

  if (!pinIdResult.success) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Invalid pin ID', { status: 404 })
  }

  // Handle PATCH requests for quick updates (like toggling readLater)
  if (request.method === 'PATCH') {
    try {
      // Parse and validate form data for partial updates
      const formData = await parseFormData(request)

      // For PATCH requests, we only update the readLater field
      if (formData.readLater !== undefined) {
        const readLater =
          formData.readLater === 'false' ? false : Boolean(formData.readLater)

        await pinService.updatePin(user.id, pinIdResult.data, {
          readLater,
        })

        logger.info('Pin readLater status updated', {
          pinId: pinIdResult.data,
          userId: user.id,
          readLater,
        })

        // Return JSON response for AJAX requests
        return data({ success: true, readLater })
      }

      return data(
        { errors: { _form: 'Invalid PATCH request' } },
        { status: 400 }
      )
    } catch (error) {
      logger.exception(error, 'Failed to update pin readLater status', {
        pinId: pinIdResult.data,
        userId: user.id,
      })

      return data(
        {
          errors: {
            _form: 'Failed to update pin. Please try again.',
          },
        },
        { status: 400 }
      )
    }
  }

  // Handle DELETE requests for pin deletion
  if (request.method === 'DELETE') {
    try {
      // Delete the pin using the service
      await pinService.deletePin(user.id, pinIdResult.data)

      logger.info('Pin deleted successfully', {
        pinId: pinIdResult.data,
        userId: user.id,
      })

      // Redirect to pins list with success message
      return setFlashMessage(
        request,
        'success',
        'Pin deleted successfully!',
        '/pins'
      )
    } catch (error) {
      logger.exception(error, 'Failed to delete pin', {
        pinId: pinIdResult.data,
        userId: user.id,
      })

      // Check for specific error types
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('Unauthorized')
      ) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw new Response('Pin not found', { status: 404 })
      }

      // Generic server error for other cases
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw new Response('Failed to delete pin. Please try again.', {
        status: 500,
      })
    }
  }

  // Handle POST/PUT requests for pin updates (existing logic)

  // Parse and validate form data
  const formData = await parseFormData(request)
  const result = validatePinDataUpdate(formData)

  if (!result.success) {
    logger.debug('Pin edit validation failed', { errors: result.errors })
    return data({ errors: result.errors }, { status: 400 })
  }

  try {
    // Update the pin using the service
    await pinService.updatePin(user.id, pinIdResult.data, {
      url: result.data.url,
      title: result.data.title,
      description: result.data.description,
      readLater: result.data.readLater || false,
      tagNames: result.data.tagNames || [],
    })

    logger.info('Pin updated successfully', {
      pinId: pinIdResult.data,
      userId: user.id,
      url: result.data.url,
    })

    // Redirect to pins list with success message
    return setFlashMessage(
      request,
      'success',
      'Pin updated successfully!',
      '/pins'
    )
  } catch (error) {
    logger.exception(error, 'Failed to update pin', {
      pinId: pinIdResult.data,
      userId: user.id,
      url: result.data.url,
    })

    return data(
      {
        errors: {
          _form: 'Failed to update pin. Please try again.',
        },
      },
      { status: 400 }
    )
  }
}

export default function PinEditPage() {
  const { pin, userTags } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const {
    loading: isMetadataLoading,
    error: metadataError,
    metadata,
    fetchMetadata,
  } = useMetadataFetch()

  // Prepare initial data for the form
  const initialData: PinCreationFormData = {
    url: pin.url,
    title: pin.title,
    description: pin.description || '',
    readLater: pin.readLater,
    tags: pin.tags?.map(tag => tag.name) || [],
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Edit Pin</h1>
          <p className="mt-2 text-muted-foreground">Update your pin details</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pin Details</CardTitle>
          </CardHeader>
          <CardContent>
            <PinCreationForm
              editMode
              initialData={initialData}
              actionUrl={`/pins/${pin.id}/edit`}
              onMetadataFetch={fetchMetadata}
              metadataTitle={metadata?.title}
              metadataError={metadataError || undefined}
              isMetadataLoading={isMetadataLoading}
              tagSuggestions={userTags}
              errorMessage={
                actionData && 'errors' in actionData && actionData.errors?._form
                  ? Array.isArray(actionData.errors._form)
                    ? actionData.errors._form.join(', ')
                    : actionData.errors._form
                  : undefined
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
