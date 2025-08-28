import { useLoaderData, useActionData, useLocation, data } from 'react-router'
import type { Route } from './+types/pins.new'
import { requireUser, setFlashMessage } from '~/lib/session.server'
import {
  requireUsernameMatch,
  getUserPath,
  extractFilterParams,
} from '~/lib/auth.server'
import { repositories, pinService } from '~/lib/services/container.server'
import { PinCreationForm } from '~/components/pins/PinCreationForm'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { ValidationError, DuplicatePinError } from '@pinsquirrel/domain'
import { parseFormData } from '~/lib/http-utils'
import { useMetadataFetch } from '~/lib/useMetadataFetch'
import { logger } from '~/lib/logger.server'
import { extractUrlParams } from '~/lib/url-params.server'

export function meta(_: Route.MetaArgs) {
  return [
    {
      title: 'Create New Pin - PinSquirrel',
    },
    {
      name: 'description',
      content:
        'Save a new link, article, or bookmark to your PinSquirrel collection.',
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Ensure user is authenticated and username matches
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Fetch user's existing tags for autocomplete
  const userTags = await repositories.tag.findByUserId(user.id)

  // Extract and sanitize URL parameters (for bookmarklet integration)
  const urlParams = extractUrlParams(request)

  return data({
    userTags: userTags.map(tag => tag.name),
    urlParams,
    username: params.username,
  })
}

export async function action({ request, params }: Route.ActionArgs) {
  // Ensure user is authenticated and username matches
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Parse and validate form data
  const formData = await parseFormData(request)

  try {
    // Create the pin using service
    const pin = await pinService.createPinFromFormData(user.id, formData)

    logger.info('Pin created successfully', {
      pinId: pin.id,
      userId: user.id,
      url: pin.url,
    })

    // Redirect to user's pins list with success message, preserving filter params
    const filterParams = extractFilterParams(request)
    const redirectTo = getUserPath(user.username, '/pins', filterParams)
    return setFlashMessage(
      request,
      'success',
      'Pin created successfully!',
      redirectTo
    )
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.debug('Pin creation validation failed', { errors: error.fields })
      return data({ errors: error.fields }, { status: 400 })
    }

    if (error instanceof DuplicatePinError) {
      logger.debug('Pin creation failed - duplicate URL')
      return data(
        {
          errors: {
            url: ['You have already saved this URL'],
          },
        },
        { status: 400 }
      )
    }

    logger.exception(error, 'Failed to create pin', {
      userId: user.id,
    })

    return data(
      {
        errors: {
          _form: ['Failed to create pin. Please try again.'],
        },
      },
      { status: 500 }
    )
  }
}

export default function PinsNewPage() {
  const { userTags, urlParams, username } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const location = useLocation()
  const {
    loading: isMetadataLoading,
    error: metadataError,
    metadata,
    fetchMetadata,
  } = useMetadataFetch()

  // Build back link with preserved query parameters
  const backToPinsUrl = `/${username}/pins${location.search}`

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
          <CardTitle>Create New Pin</CardTitle>
        </CardHeader>
        <CardContent>
          <PinCreationForm
            onMetadataFetch={fetchMetadata}
            metadataTitle={metadata?.title}
            metadataDescription={metadata?.description}
            metadataError={metadataError || undefined}
            isMetadataLoading={isMetadataLoading}
            tagSuggestions={userTags}
            urlParams={urlParams}
            errorMessage={
              actionData?.errors && '_form' in actionData.errors
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
