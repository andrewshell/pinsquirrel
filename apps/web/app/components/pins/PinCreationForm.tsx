import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Label } from '~/components/ui/label'
import { DismissibleAlert } from '~/components/ui/dismissible-alert'
import {
  pinCreationSchema,
  type PinCreationFormData,
} from '~/lib/validation/pin-schema'

interface PinCreationFormProps {
  onMetadataFetch?: (url: string) => void
  metadataTitle?: string
  metadataError?: string
  isMetadataLoading?: boolean
  isLoading?: boolean
  successMessage?: string
  errorMessage?: string
  editMode?: boolean
  initialData?: PinCreationFormData
  actionUrl?: string
}

export function PinCreationForm({
  onMetadataFetch,
  metadataTitle,
  metadataError,
  isMetadataLoading,
  isLoading,
  successMessage,
  errorMessage,
  editMode = false,
  initialData,
  actionUrl,
}: PinCreationFormProps) {
  const {
    register,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<PinCreationFormData>({
    resolver: zodResolver(pinCreationSchema),
    defaultValues: initialData || {
      url: '',
      title: '',
      description: '',
    },
  })

  // Client-side state for dismissing flash messages
  const [showSuccessMessage, setShowSuccessMessage] = useState(!!successMessage)
  const [showErrorMessage, setShowErrorMessage] = useState(!!errorMessage)

  const urlValue = watch('url')

  // Auto-populate title when metadata is fetched
  useEffect(() => {
    if (metadataTitle) {
      setValue('title', metadataTitle)
    }
  }, [metadataTitle, setValue])

  // Focus management for validation errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      // Focus the first field with an error
      const firstErrorField = errors.url ? 'url' : errors.title ? 'title' : null
      if (firstErrorField) {
        const element = document.getElementById(firstErrorField)
        if (element && element instanceof HTMLInputElement) {
          element.focus()
        }
      }
    }
  }, [errors])

  const handleUrlBlur = () => {
    // Don't fetch metadata in edit mode
    if (editMode) {
      return
    }

    if (urlValue && onMetadataFetch) {
      try {
        new URL(urlValue) // Validate URL before fetching
        onMetadataFetch(urlValue)
      } catch {
        // Invalid URL, don't fetch metadata
      }
    }
  }

  return (
    <form
      method="post"
      action={actionUrl || '/pins/new'}
      className="space-y-4"
      noValidate
      aria-label={editMode ? 'Edit pin' : 'Create new pin'}
    >
      {successMessage && (
        <DismissibleAlert
          message={successMessage}
          type="success"
          show={showSuccessMessage}
          onDismiss={() => setShowSuccessMessage(false)}
        />
      )}

      {errorMessage && (
        <DismissibleAlert
          message={errorMessage}
          type="error"
          show={showErrorMessage}
          onDismiss={() => setShowErrorMessage(false)}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          type="url"
          placeholder="https://example.com"
          {...register('url', { onBlur: handleUrlBlur })}
          aria-invalid={!!errors.url}
          aria-describedby={errors.url ? 'url-error url-help' : 'url-help'}
          aria-required="true"
        />
        <p id="url-help" className="text-xs text-muted-foreground">
          Enter the web address you want to save as a pin
        </p>
        {errors.url && (
          <p id="url-error" className="text-sm text-destructive" role="alert">
            {errors.url.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <div className="relative">
          <Input
            id="title"
            type="text"
            placeholder="Enter a title"
            {...register('title')}
            aria-invalid={!!errors.title}
            aria-describedby={
              errors.title
                ? 'title-error title-help'
                : isMetadataLoading
                  ? 'title-loading title-help'
                  : 'title-help'
            }
            aria-required="true"
          />
          {isMetadataLoading && (
            <span
              id="title-loading"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              Fetching page title...
            </span>
          )}
        </div>
        <p id="title-help" className="text-xs text-muted-foreground">
          A descriptive title for your pin. We&apos;ll try to auto-fill this
          from the page.
        </p>
        {errors.title && (
          <p id="title-error" className="text-sm text-destructive" role="alert">
            {errors.title.message}
          </p>
        )}
        {metadataError && (
          <p className="text-sm text-muted-foreground" role="status">
            Failed to fetch metadata. Please enter title manually.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="Add a description..."
          {...register('description')}
          rows={4}
          aria-describedby="description-help"
          aria-required="false"
        />
        <p id="description-help" className="text-xs text-muted-foreground">
          Optional notes or context about this pin
        </p>
      </div>

      <Button
        type="submit"
        disabled={isLoading || isSubmitting}
        className="w-full"
        aria-describedby={isLoading ? 'submit-status' : undefined}
      >
        {isLoading
          ? editMode
            ? 'Updating...'
            : 'Creating...'
          : editMode
            ? 'Update Pin'
            : 'Create Pin'}
        {isLoading && (
          <span id="submit-status" className="sr-only">
            Form is being submitted, please wait
          </span>
        )}
      </Button>
    </form>
  )
}
