import { useLoaderData, useActionData, data } from 'react-router'
import type { Route } from './+types/pins.$id.edit'
import { requireUser, setFlashMessage } from '~/lib/session.server'
import { pinService } from '~/lib/services/pinService.server'
import { PinCreationForm } from '~/components/pins/PinCreationForm'
import {
  pinCreationSchema,
  type PinCreationFormData,
} from '~/lib/validation/pin-schema'
import { useMetadataFetch } from '~/lib/useMetadataFetch'
import { logger } from '~/lib/logger.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  // Ensure user is authenticated
  const user = await requireUser(request)

  // Get pin ID from params
  const pinId = params.id
  if (!pinId) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Pin ID is required', { status: 404 })
  }

  // Fetch the pin using the service
  try {
    const pin = await pinService.getPin(user.id, pinId)
    return data({ pin })
  } catch (error) {
    logger.exception(error, 'Failed to load pin for editing', {
      pinId,
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

  // Get pin ID from params
  const pinId = params.id
  if (!pinId) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Pin ID is required', { status: 404 })
  }

  const formData = await request.formData()
  const url = formData.get('url') as string | null
  const title = formData.get('title') as string | null
  const description = formData.get('description') as string | null

  // Validate form data
  const validation = pinCreationSchema.safeParse({
    url: url || '',
    title: title || '',
    description: description || undefined,
  })

  if (!validation.success) {
    const errors: Record<string, string> = {}
    validation.error.issues.forEach(error => {
      const field = error.path[0] as string
      errors[field] = error.message
    })
    return data({ errors }, { status: 400 })
  }

  try {
    // Update the pin using the service
    await pinService.updatePin(user.id, pinId, {
      url: validation.data.url,
      title: validation.data.title,
      description: validation.data.description,
      readLater: false, // Keep existing readLater value (not edited in this form)
    })

    logger.info('Pin updated successfully', {
      pinId,
      userId: user.id,
      url: validation.data.url,
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
      pinId,
      userId: user.id,
      url: validation.data.url,
    })

    return data(
      {
        error: 'Failed to update pin. Please try again.',
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

        <div className="bg-card rounded-lg shadow-sm p-6">
          <PinCreationForm
            editMode
            initialData={initialData}
            actionUrl={`/pins/${pin.id}/edit`}
            onMetadataFetch={fetchMetadata}
            metadataTitle={metadata?.title}
            metadataError={metadataError || undefined}
            isMetadataLoading={isMetadataLoading}
            errorMessage={
              actionData && 'error' in actionData ? actionData.error : undefined
            }
          />
        </div>
      </div>
    </div>
  )
}
