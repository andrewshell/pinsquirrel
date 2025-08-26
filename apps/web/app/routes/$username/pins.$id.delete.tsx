import { useLoaderData, useLocation, data } from 'react-router'
import type { Route } from './+types/pins.$id.delete'
import { requireUser, setFlashMessage } from '~/lib/session.server'
import {
  requireUsernameMatch,
  getUserPath,
  extractFilterParams,
} from '~/lib/auth.server'
import { pinService } from '~/lib/services/container.server'
import { parseParams } from '~/lib/http-utils'
import { logger } from '~/lib/logger.server'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Form, useNavigation, Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function meta(_: Route.MetaArgs) {
  return [
    {
      title: 'Delete Pin - PinSquirrel',
    },
    {
      name: 'description',
      content: 'Confirm deletion of your saved link, article, or bookmark.',
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Ensure user is authenticated and username matches
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Validate pin ID from params
  const paramData = parseParams(params)
  const pinId = paramData.id

  if (!pinId || typeof pinId !== 'string') {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Invalid pin ID', { status: 404 })
  }

  // Fetch the pin to confirm ownership and get details for deletion
  try {
    const pin = await pinService.getPin(user.id, pinId)

    return data({
      pin,
      username: params.username,
    })
  } catch (error) {
    logger.exception(error, 'Failed to load pin for deletion', {
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

  // Validate pin ID from params
  const paramData = parseParams(params)
  const pinId = paramData.id

  if (!pinId || typeof pinId !== 'string') {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Invalid pin ID', { status: 404 })
  }

  // Only handle DELETE requests
  if (request.method !== 'DELETE') {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Method not allowed', { status: 405 })
  }

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

export default function PinDeletePage() {
  const { pin, username } = useLoaderData<typeof loader>()
  const location = useLocation()
  const navigation = useNavigation()
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  // Build back link with preserved query parameters
  const backToPinsUrl = `/${username}/pins${location.search}`

  // Check if we're currently deleting
  const isDeleting =
    navigation.state === 'submitting' && navigation.formMethod === 'DELETE'

  // Focus the delete button when page loads
  useEffect(() => {
    if (deleteButtonRef.current) {
      // Small delay to ensure the page is fully rendered
      const timeoutId = setTimeout(() => {
        deleteButtonRef.current?.focus()
      }, 150)
      return () => clearTimeout(timeoutId)
    }
  }, [])

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
          <CardTitle>Delete Pin</CardTitle>
          <CardDescription>
            Are you sure you want to delete this pin? This action cannot be
            undone.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">{pin.title}</h4>
            <p className="text-sm text-muted-foreground break-all">{pin.url}</p>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            asChild
            disabled={isDeleting}
          >
            <Link to={backToPinsUrl}>Cancel</Link>
          </Button>
          <Form method="DELETE" className="flex-1">
            <Button
              ref={deleteButtonRef}
              type="submit"
              variant="destructive"
              disabled={isDeleting}
              className="w-full"
            >
              {isDeleting ? 'Deleting...' : 'Delete Pin'}
            </Button>
          </Form>
        </CardFooter>
      </Card>
    </div>
  )
}
