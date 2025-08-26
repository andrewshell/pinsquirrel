import {
  useLoaderData,
  useActionData,
  useParams,
  useLocation,
  data,
} from 'react-router'
import type { Route } from './+types/pins.$id.edit'
import { requireUser, setFlashMessage } from '~/lib/session.server'
import {
  requireUsernameMatch,
  getUserPath,
  extractFilterParams,
} from '~/lib/auth.server'
import { pinService, repositories } from '~/lib/services/container.server'
import { PinCreationForm } from '~/components/pins/PinCreationForm'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import {
  ValidationError,
  DuplicatePinError,
  PinNotFoundError,
  UnauthorizedPinAccessError,
} from '@pinsquirrel/domain'
import { parseFormData, parseParams } from '~/lib/http-utils'
import { useMetadataFetch } from '~/lib/useMetadataFetch'
import { logger } from '~/lib/logger.server'
import { extractUrlParams } from '~/lib/url-params.server'

// Pin creation form data type
export type PinCreationFormData = {
  url: string
  title: string
  description?: string
  readLater?: boolean
  tags?: string[]
}

export function meta(_: Route.MetaArgs) {
  return [
    {
      title: 'Edit Pin - PinSquirrel',
    },
    {
      name: 'description',
      content: 'Edit your saved link, article, or bookmark on PinSquirrel.',
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Ensure user is authenticated and username matches
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Simple ID validation - just check it exists
  const paramData = parseParams(params)
  const pinId = paramData.id

  if (!pinId || typeof pinId !== 'string') {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Invalid pin ID', { status: 404 })
  }

  // Extract URL parameters for tag suggestions and other pre-filling
  const urlParams = extractUrlParams(request)

  // Fetch the pin using the service and user's existing tags for autocomplete
  try {
    const [pin, userTags] = await Promise.all([
      pinService.getPin(user.id, pinId),
      repositories.tag.findByUserId(user.id),
    ])

    return data({
      pin,
      userTags: userTags.map(tag => tag.name),
      urlParams,
    })
  } catch (error) {
    logger.exception(error, 'Failed to load pin for editing', {
      pinId: pinId,
      userId: user.id,
    })

    // If pin not found or unauthorized, throw 404
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Pin not found', { status: 404 })
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  // Ensure user is authenticated and username matches
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Simple ID validation - just check it exists
  const paramData = parseParams(params)
  const pinId = paramData.id

  if (!pinId || typeof pinId !== 'string') {
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

        await pinService.updatePin(user.id, pinId, {
          readLater,
        })

        logger.info('Pin readLater status updated', {
          pinId: pinId,
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
        pinId: pinId,
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
      await pinService.deletePin(user.id, pinId)

      logger.info('Pin deleted successfully', {
        pinId: pinId,
        userId: user.id,
      })

      // Redirect to user's pins list with success message, preserving filter params
      const filterParams = extractFilterParams(request)
      const redirectTo = getUserPath(user.username, '/pins', filterParams)
      return setFlashMessage(
        request,
        'success',
        'Pin deleted successfully!',
        redirectTo
      )
    } catch (error) {
      logger.exception(error, 'Failed to delete pin', {
        pinId: pinId,
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

  try {
    // Update the pin using service with form data validation
    await pinService.updatePinFromFormData(user.id, pinId, formData)

    logger.info('Pin updated successfully', {
      pinId: pinId,
      userId: user.id,
    })

    // Redirect to user's pins list with success message, preserving filter params
    const filterParams = extractFilterParams(request)
    const redirectTo = getUserPath(user.username, '/pins', filterParams)
    return setFlashMessage(
      request,
      'success',
      'Pin updated successfully!',
      redirectTo
    )
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.debug('Pin edit validation failed', { errors: error.fields })
      return data({ errors: error.fields }, { status: 400 })
    }

    if (error instanceof DuplicatePinError) {
      logger.debug('Pin edit failed - duplicate URL')
      return data(
        {
          errors: {
            url: ['You have already saved this URL'],
          },
        },
        { status: 400 }
      )
    }

    if (error instanceof PinNotFoundError) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw new Response('Pin not found', { status: 404 })
    }

    if (error instanceof UnauthorizedPinAccessError) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw new Response('Unauthorized', { status: 403 })
    }

    logger.exception(error, 'Failed to update pin', {
      pinId: pinId,
      userId: user.id,
    })

    return data(
      {
        errors: {
          _form: 'Failed to update pin. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}

export default function PinEditPage() {
  const { pin, userTags, urlParams } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const params = useParams()
  const location = useLocation()
  const {
    loading: isMetadataLoading,
    error: metadataError,
    metadata,
    fetchMetadata,
  } = useMetadataFetch()

  // Build back link with preserved query parameters
  const backToPinsUrl = `/${params.username}/pins${location.search}`

  // Prepare initial data for the form
  const initialData: PinCreationFormData = {
    url: pin.url,
    title: pin.title,
    description: pin.description || '',
    readLater: pin.readLater,
    tags: pin.tags?.map(tag => tag.name) || [],
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to={backToPinsUrl}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Pins
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Pin</CardTitle>
        </CardHeader>
        <CardContent>
          <PinCreationForm
            editMode
            initialData={initialData}
            actionUrl={`/${params.username}/pins/${pin.id}/edit${location.search}`}
            onMetadataFetch={fetchMetadata}
            metadataTitle={metadata?.title}
            metadataDescription={metadata?.description}
            metadataError={metadataError || undefined}
            isMetadataLoading={isMetadataLoading}
            tagSuggestions={userTags}
            urlParams={urlParams}
            errorMessage={
              actionData &&
              'errors' in actionData &&
              actionData.errors &&
              '_form' in actionData.errors
                ? Array.isArray(actionData.errors._form)
                  ? actionData.errors._form.join(', ')
                  : actionData.errors._form
                : undefined
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
