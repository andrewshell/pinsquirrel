import { useLoaderData, useActionData, data } from 'react-router'
import type { Route } from './+types/$username.pins.new'
import { requireUser, setFlashMessage } from '~/lib/session.server'
import { requireUsernameMatch, getUserPath } from '~/lib/auth.server'
import { repositories } from '~/lib/services/container.server'
import { PinCreationForm } from '~/components/pins/PinCreationForm'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { validateNewPinData } from '@pinsquirrel/core'
import { parseFormData } from '~/lib/http-utils'
import { useMetadataFetch } from '~/lib/useMetadataFetch'
import { logger } from '~/lib/logger.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  // Ensure user is authenticated and username matches
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Fetch user's existing tags for autocomplete
  const userTags = await repositories.tag.findByUserId(user.id)

  return data({
    userTags: userTags.map(tag => tag.name),
  })
}

export async function action({ request, params }: Route.ActionArgs) {
  // Ensure user is authenticated and username matches
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Parse and validate form data
  const formData = await parseFormData(request)
  const result = validateNewPinData(formData)

  if (!result.success) {
    logger.debug('Pin creation validation failed', { errors: result.errors })
    return data({ errors: result.errors }, { status: 400 })
  }

  try {
    // Create the pin
    const pin = await repositories.pin.create({
      userId: user.id,
      url: result.data.url,
      title: result.data.title,
      description: result.data.description || '',
      readLater: result.data.readLater || false,
      tagNames: result.data.tagNames || [],
    })

    logger.info('Pin created successfully', {
      pinId: pin.id,
      userId: user.id,
      url: pin.url,
    })

    // Redirect to user's pins list with success message
    const redirectTo = getUserPath(user.username)
    return setFlashMessage(
      request,
      'success',
      'Pin created successfully!',
      redirectTo
    )
  } catch (error) {
    logger.exception(error, 'Failed to create pin', {
      userId: user.id,
      url: result.data.url,
    })

    return data(
      {
        errors: {
          _form: 'Failed to create pin. Please try again.',
        },
      },
      { status: 400 }
    )
  }
}

export default function PinsNewPage() {
  const { userTags } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const {
    loading: isMetadataLoading,
    error: metadataError,
    metadata,
    fetchMetadata,
  } = useMetadataFetch()

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Create New Pin</h1>
          <p className="mt-2 text-muted-foreground">
            Save a bookmark, image, or article to your collection
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pin Details</CardTitle>
          </CardHeader>
          <CardContent>
            <PinCreationForm
              onMetadataFetch={fetchMetadata}
              metadataTitle={metadata?.title}
              metadataError={metadataError || undefined}
              isMetadataLoading={isMetadataLoading}
              tagSuggestions={userTags}
              errorMessage={
                actionData?.errors?._form
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
