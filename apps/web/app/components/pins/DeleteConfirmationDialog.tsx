import { useEffect, useRef } from 'react'
import { Form, useNavigation } from 'react-router'
import type { Pin } from '@pinsquirrel/core'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'

interface DeleteConfirmationDialogProps {
  pin: Pin
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteConfirmationDialog({
  pin,
  open,
  onOpenChange,
}: DeleteConfirmationDialogProps) {
  const navigation = useNavigation()
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  // Check if we're currently deleting this specific pin
  const isDeleting =
    navigation.state === 'submitting' &&
    navigation.formMethod === 'DELETE' &&
    navigation.formAction === `/pins/${pin.id}/edit`

  // Focus the delete button when dialog opens
  useEffect(() => {
    if (open && deleteButtonRef.current) {
      // Small delay to ensure the dialog is fully rendered and focus guards are set up
      const timeoutId = setTimeout(() => {
        deleteButtonRef.current?.focus()
      }, 150)
      return () => clearTimeout(timeoutId)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogHeader>
          <DialogTitle id="delete-dialog-title">Delete Pin</DialogTitle>
          <DialogDescription id="delete-dialog-description">
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
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Form method="DELETE" action={`/pins/${pin.id}/edit`}>
            <Button
              ref={deleteButtonRef}
              type="submit"
              variant="destructive"
              disabled={isDeleting}
              aria-describedby="delete-dialog-description"
            >
              {isDeleting ? 'Deleting...' : 'Delete Pin'}
            </Button>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
