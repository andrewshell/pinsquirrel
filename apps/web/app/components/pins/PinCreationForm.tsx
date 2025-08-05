import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Label } from '~/components/ui/label'
import { pinCreationSchema, type PinCreationFormData } from '~/lib/validation/pin-schema'

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
    formState: { errors },
    setValue,
    watch,
  } = useForm<PinCreationFormData>({
    resolver: zodResolver(pinCreationSchema),
  })

  const onSubmitWrapper = (data: PinCreationFormData) => {
    onSubmit(data)
  }

  const urlValue = watch('url')

  // Auto-populate title when metadata is fetched
  useEffect(() => {
    if (metadataTitle) {
      setValue('title', metadataTitle)
    }
  }, [metadataTitle, setValue])

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
      onSubmit={handleSubmit(onSubmitWrapper)} 
      method="post" 
      action="/pins/new" 
      className="space-y-4"
    >
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          name="url"
          type="url"
          placeholder="https://example.com"
          {...register('url', { onBlur: handleUrlBlur })}
          aria-invalid={!!errors.url}
          aria-describedby={errors.url ? 'url-error' : undefined}
        />
        {errors.url && (
          <p id="url-error" className="text-sm text-destructive">
            {errors.url.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <div className="relative">
          <Input
            id="title"
            name="title"
            type="text"
            placeholder="Enter a title"
            {...register('title')}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'title-error' : undefined}
          />
          {isMetadataLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              Fetching page title...
            </span>
          )}
        </div>
        {errors.title && (
          <p id="title-error" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        )}
        {metadataError && (
          <p className="text-sm text-muted-foreground">
            Failed to fetch metadata
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Add a description..."
          {...register('description')}
          rows={4}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Creating...' : 'Create Pin'}
      </Button>
    </form>
  )
}