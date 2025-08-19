import { useEffect, useState, useRef, useMemo } from 'react'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Label } from '~/components/ui/label'
import { FormText } from '~/components/ui/form-text'
import { Checkbox } from '~/components/ui/checkbox'
import { DismissibleAlert } from '~/components/ui/dismissible-alert'
import { TagInput } from '~/components/ui/tag-input'
import type { FieldErrors } from '@pinsquirrel/core'
import { isValidUrl } from '@pinsquirrel/core'
import type { UrlParams } from '~/lib/url-params.server'

// Pin creation form data type
type PinCreationFormData = {
  url: string
  title: string
  description?: string
  readLater?: boolean
  tags?: string[]
}

interface PinCreationFormProps {
  onMetadataFetch?: (url: string) => void
  metadataTitle?: string
  metadataDescription?: string
  metadataError?: string
  isMetadataLoading?: boolean
  successMessage?: string
  errorMessage?: string
  editMode?: boolean
  initialData?: PinCreationFormData
  actionUrl?: string
  tagSuggestions?: string[]
  urlParams?: UrlParams | null
}

export function PinCreationForm({
  onMetadataFetch,
  metadataTitle,
  metadataDescription,
  metadataError,
  isMetadataLoading,
  successMessage,
  errorMessage,
  editMode = false,
  initialData,
  actionUrl,
  tagSuggestions = [],
  urlParams,
}: PinCreationFormProps) {
  const fetcher = useFetcher<{ errors?: FieldErrors }>()
  const formRef = useRef<HTMLFormElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  // Merge initial data with URL parameters (URL params take precedence for bookmarklet)
  const mergedInitialData = useMemo(
    () => ({
      url: urlParams?.url || initialData?.url || '',
      title: urlParams?.title || initialData?.title || '',
      description: urlParams?.description || initialData?.description || '',
      readLater: initialData?.readLater || false,
      tags: initialData?.tags || [],
    }),
    [urlParams, initialData]
  )

  // Client-side state for dismissing flash messages and URL tracking
  const [showSuccessMessage, setShowSuccessMessage] = useState(!!successMessage)
  const [showErrorMessage, setShowErrorMessage] = useState(!!errorMessage)
  const [urlValue, setUrlValue] = useState(mergedInitialData.url)
  const [tags, setTags] = useState<string[]>(mergedInitialData.tags)

  // Get validation errors from fetcher or props (memoized to prevent useEffect dependencies changing)
  const errors = useMemo(
    () => fetcher.data?.errors || {},
    [fetcher.data?.errors]
  )
  const isSubmitting = fetcher.state === 'submitting'

  // Auto-populate title and description when metadata is fetched
  useEffect(() => {
    if (metadataTitle && titleRef.current) {
      titleRef.current.value = metadataTitle
    }
  }, [metadataTitle])

  useEffect(() => {
    if (metadataDescription && descriptionRef.current) {
      // Only auto-populate if the description field is currently empty
      if (!descriptionRef.current.value.trim()) {
        descriptionRef.current.value = metadataDescription
      }
    }
  }, [metadataDescription])

  // Focus management for validation errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      // Focus the first field with an error
      if (errors.url && urlRef.current) {
        urlRef.current.focus()
      } else if (errors.title && titleRef.current) {
        titleRef.current.focus()
      }
    }
  }, [errors])

  const handleUrlBlur = () => {
    // Don't fetch metadata in edit mode
    if (editMode) {
      return
    }

    if (urlValue && onMetadataFetch) {
      // Use centralized URL validation
      if (isValidUrl(urlValue)) {
        onMetadataFetch(urlValue)
      }
      // Invalid URL, don't fetch metadata
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlValue(e.target.value)
  }

  return (
    <fetcher.Form
      ref={formRef}
      method="post"
      action={actionUrl}
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

      {/* Server validation errors */}
      {errors._form && (
        <DismissibleAlert
          message={
            Array.isArray(errors._form) ? errors._form.join(', ') : errors._form
          }
          type="error"
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input
          ref={urlRef}
          id="url"
          name="url"
          type="url"
          placeholder="https://example.com"
          defaultValue={mergedInitialData.url}
          onChange={handleUrlChange}
          onBlur={handleUrlBlur}
          aria-invalid={!!errors.url}
          aria-describedby={errors.url ? 'url-error url-help' : 'url-help'}
          aria-required="true"
          className={errors.url ? 'border-red-500' : ''}
        />
        <FormText id="url-help" size="xs">
          Enter the web address you want to save as a pin
        </FormText>
        {errors.url && (
          <p id="url-error" className="text-sm text-destructive" role="alert">
            {Array.isArray(errors.url) ? errors.url.join(', ') : errors.url}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <div className="relative">
          <Input
            ref={titleRef}
            id="title"
            name="title"
            type="text"
            placeholder="Enter a title"
            defaultValue={mergedInitialData.title}
            aria-invalid={!!errors.title}
            aria-describedby={
              errors.title
                ? 'title-error title-help'
                : isMetadataLoading
                  ? 'title-loading title-help'
                  : 'title-help'
            }
            aria-required="true"
            className={errors.title ? 'border-red-500' : ''}
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
        <FormText id="title-help" size="xs">
          A descriptive title for your pin. We&apos;ll try to auto-fill this
          from the page.
        </FormText>
        {errors.title && (
          <p id="title-error" className="text-sm text-destructive" role="alert">
            {Array.isArray(errors.title)
              ? errors.title.join(', ')
              : errors.title}
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
          ref={descriptionRef}
          id="description"
          name="description"
          placeholder="Add a description..."
          defaultValue={mergedInitialData.description}
          rows={4}
          aria-describedby="description-help"
          aria-required="false"
        />
        <FormText id="description-help" size="xs">
          Optional notes or context about this pin. We&apos;ll try to auto-fill
          this from the page.
        </FormText>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags" id="tags-label">
          Tags (optional)
        </Label>
        <TagInput
          id="tags"
          aria-labelledby="tags-label"
          tags={tags}
          onTagsChange={setTags}
          suggestions={tagSuggestions}
          placeholder="Add tags..."
          disabled={isSubmitting}
          maxTags={10}
        />
        <FormText id="tags-help" size="xs">
          Add tags to help organize and find your pins
        </FormText>
        {/* Hidden inputs for form submission */}
        {tags.map((tag, index) => (
          <input
            key={`tag-${index}`}
            type="hidden"
            name="tagNames"
            value={tag}
          />
        ))}
      </div>

      <div className="space-y-2">
        <Checkbox
          id="readLater"
          name="readLater"
          label="Read Later"
          defaultChecked={mergedInitialData.readLater}
        />
        <FormText id="readLater-help" size="xs">
          Mark this pin to read later
        </FormText>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
        aria-describedby={isSubmitting ? 'submit-status' : undefined}
      >
        {isSubmitting
          ? editMode
            ? 'Updating...'
            : 'Creating...'
          : editMode
            ? 'Update Pin'
            : 'Create Pin'}
        {isSubmitting && (
          <span id="submit-status" className="sr-only">
            Form is being submitted, please wait
          </span>
        )}
      </Button>
    </fetcher.Form>
  )
}
