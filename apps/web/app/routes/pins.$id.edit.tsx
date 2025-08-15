import { useLoaderData, useActionData, data } from 'react-router'
import type { Route } from './+types/pins.$id.edit'
import { requireUser, setFlashMessage } from '~/lib/session.server'
import { pinService } from '~/lib/services/container.server'
import { PinCreationForm } from '~/components/pins/PinCreationForm'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { validatePinCreation, validateIdParam } from '@pinsquirrel/core'
import { parseFormData, parseParams } from '~/lib/http-utils'
import { useMetadataFetch } from '~/lib/useMetadataFetch'
import { logger } from '~/lib/logger.server'

// Pin creation form data type
export type PinCreationFormData = {
  url: string
  title: string
  description?: string
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

  // Fetch the pin using the service
  try {
    const pin = await pinService.getPin(user.id, pinIdResult.data)
    return data({ pin })
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

  // Parse and validate form data
  const formData = await parseFormData(request)
  const result = validatePinCreation(formData)

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
      readLater: false, // Keep existing readLater value (not edited in this form)
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
  const { pin } = useLoaderData<typeof loader>()
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
