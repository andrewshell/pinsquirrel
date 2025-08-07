import { useActionData } from 'react-router'
import type { Route } from './+types/pins.new'
import { requireUser, setFlashMessage } from '~/lib/session.server'
import {
  DrizzlePinRepository,
  DrizzleTagRepository,
  db,
} from '@pinsquirrel/database'
import { PinCreationForm } from '~/components/pins/PinCreationForm'
import {
  pinCreationSchema,
  type PinCreationFormData,
} from '~/lib/validation/pin-schema'
import { useMetadataFetch } from '~/lib/useMetadataFetch'
import { logger } from '~/lib/logger.server'

// Server-side repositories
const tagRepository = new DrizzleTagRepository(db)
const pinRepository = new DrizzlePinRepository(db, tagRepository)

export async function loader({ request }: Route.LoaderArgs) {
  // Ensure user is authenticated
  await requireUser(request)
  return null
}

export async function action({ request }: Route.ActionArgs) {
  // Ensure user is authenticated
  const user = await requireUser(request)

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
    return { errors }
  }

  try {
    // Create the pin
    const pin = await pinRepository.create({
      userId: user.id,
      url: validation.data.url,
      title: validation.data.title,
      description: validation.data.description || '',
      readLater: false,
    })

    logger.info('Pin created successfully', {
      pinId: pin.id,
      userId: user.id,
      url: pin.url,
    })

    // Redirect to pins list with success message
    return setFlashMessage(
      request,
      'success',
      'Pin created successfully!',
      '/pins'
    )
  } catch (error) {
    logger.exception(error, 'Failed to create pin', {
      userId: user.id,
      url: validation.data.url,
    })

    return {
      error: 'Failed to create pin. Please try again.',
    }
  }
}

export default function PinsNewPage() {
  const actionData = useActionData<typeof action>()
  const {
    loading: isMetadataLoading,
    error: metadataError,
    metadata,
    fetchMetadata,
  } = useMetadataFetch()

  const handleSubmit = async (_data: PinCreationFormData) => {
    // This will be handled by the form's own submission when using the regular form
    // The component still needs this prop for compatibility
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Create New Pin</h1>
          <p className="mt-2 text-muted-foreground">
            Save a bookmark, image, or article to your collection
          </p>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-6">
          <PinCreationForm
            onSubmit={handleSubmit}
            onMetadataFetch={fetchMetadata}
            metadataTitle={metadata?.title}
            metadataError={metadataError || undefined}
            isMetadataLoading={isMetadataLoading}
            errorMessage={actionData?.error}
          />
        </div>
      </div>
    </div>
  )
}
