import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Label } from '~/components/ui/label'
import {
  pinCreationSchema,
  type PinCreationFormData,
} from '~/lib/validation/pin-schema'

interface PinCreationFormProps {
  onSubmit: (data: PinCreationFormData) => void | Promise<void>
  onMetadataFetch?: (url: string) => void
  metadataTitle?: string
  metadataError?: string
  isMetadataLoading?: boolean
  isLoading?: boolean
  successMessage?: string
  errorMessage?: string
}

export function PinCreationForm({
  onSubmit,
  onMetadataFetch,
  metadataTitle,
  metadataError,
  isMetadataLoading,
  isLoading,
  successMessage,
  errorMessage,
}: PinCreationFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<PinCreationFormData>({
    resolver: zodResolver(pinCreationSchema),
  })

  const onSubmitWrapper = (data: PinCreationFormData) => {
    void onSubmit(data)
  }

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
      onSubmit={e => void handleSubmit(onSubmitWrapper)(e)}
      method="post"
      action="/pins/new"
      className="space-y-4"
      noValidate
      aria-label="Create new pin"
    >
      {successMessage && (
        <div
          className="rounded-md bg-green-50 p-4 text-sm text-green-800"
          role="alert"
          aria-live="polite"
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          className="rounded-md bg-red-50 p-4 text-sm text-red-800"
          role="alert"
          aria-live="assertive"
        >
          {errorMessage}
        </div>
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
        {isLoading ? 'Creating...' : 'Create Pin'}
        {isLoading && (
          <span id="submit-status" className="sr-only">
            Form is being submitted, please wait
          </span>
        )}
      </Button>
    </form>
  )
}
