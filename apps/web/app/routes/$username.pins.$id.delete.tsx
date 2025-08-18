import { useLoaderData, useNavigate, data } from 'react-router'
import type { Route } from './+types/$username.pins.$id.delete'
import { requireUser, setFlashMessage } from '~/lib/session.server'
import { requireUsernameMatch, getUserPath } from '~/lib/auth.server'
import { pinService } from '~/lib/services/container.server'
import { validateIdParam } from '@pinsquirrel/core'
import { parseParams } from '~/lib/http-utils'
import { logger } from '~/lib/logger.server'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Form, useNavigation } from 'react-router'
import { useEffect, useRef } from 'react'

export async function loader({ request, params }: Route.LoaderArgs) {
  // Ensure user is authenticated and username matches
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Validate pin ID from params
  const paramData = parseParams(params)
  const pinIdResult = validateIdParam(paramData.id)

  if (!pinIdResult.success) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response('Invalid pin ID', { status: 404 })
  }

  // Fetch the pin to confirm ownership and get details for deletion
  try {
    const pin = await pinService.getPin(user.id, pinIdResult.data)

    return data({
      pin,
    })
  } catch (error) {
    logger.exception(error, 'Failed to load pin for deletion', {
      pinId: pinIdResult.data,
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
  const pinIdResult = validateIdParam(paramData.id)

  if (!pinIdResult.success) {
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
    await pinService.deletePin(user.id, pinIdResult.data)

    logger.info('Pin deleted successfully', {
      pinId: pinIdResult.data,
      userId: user.id,
    })

    // Redirect to user's pins list with success message
    const redirectTo = getUserPath(user.username)
    return setFlashMessage(
      request,
      'success',
      'Pin deleted successfully!',
      redirectTo
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

export default function PinDeletePage() {
  const { pin } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  const handleClose = () => {
    void navigate('..')
  }

  // Check if we're currently deleting
  const isDeleting =
    navigation.state === 'submitting' && navigation.formMethod === 'DELETE'

  // Focus the delete button when dialog opens
  useEffect(() => {
    if (deleteButtonRef.current) {
      // Small delay to ensure the dialog is fully rendered and focus guards are set up
      const timeoutId = setTimeout(() => {
        deleteButtonRef.current?.focus()
      }, 150)
      return () => clearTimeout(timeoutId)
    }
  }, [])

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Pin</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this pin? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        {/* Pin details */}
        <div className="py-4">
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">{pin.title}</h4>
            <p className="text-sm text-muted-foreground break-all">{pin.url}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Form method="DELETE">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
