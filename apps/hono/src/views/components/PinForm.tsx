import type { FC } from 'hono/jsx'
import { Button, Input, Textarea, Checkbox, Label } from '@pinsquirrel/ui'
import { TagInput } from './TagInput'
import { ErrorMessage } from './FlashMessage'
import { RefreshIcon } from './icons'

interface PinFormProps {
  action: string
  submitLabel: string
  /**
   * Prefix for the links this form generates, e.g. `/pins` or `/private/pins`.
   *
   * The duplicate-URL notice offers to open the existing pin; without this it
   * always pointed at `/pins/:id/edit`, walking a private-mode user out of
   * private mode. It travels to the check-url probe on `hx-vals` so the
   * server-rendered version of that notice can honour it too.
   */
  baseUrl: string
  // Field values
  url?: string
  title?: string
  description?: string
  readLater?: boolean
  isPrivate?: boolean
  tags?: string
  // Other
  pinId?: string
  duplicatePinId?: string
  userTags: string[]
  errors?: Record<string, string[]>
  createdAt?: Date
}

export const PinForm: FC<PinFormProps> = ({
  action,
  submitLabel,
  baseUrl,
  url = '',
  title = '',
  description = '',
  readLater = false,
  isPrivate = false,
  tags = '',
  pinId,
  duplicatePinId,
  userTags,
  errors,
  createdAt,
}) => {
  // Format created date if provided
  const createdDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div id="pin-form-container">
      <form
        method="post"
        action={action}
        hx-post={action}
        hx-target="#pin-form-container"
        hx-swap="innerHTML"
        class="space-y-4"
        novalidate
        data-metadata-fetch
      >
        {/* Form-level errors */}
        {errors?._form && <ErrorMessage message={errors._form.join('. ')} />}

        {/* URL field. A duplicate URL is reported by the warning below rather
            than through Input's own error slot, so the red outline has to be
            passed in as a class. */}
        <div class="space-y-2">
          <Label for="url">URL</Label>
          <Input
            id="url"
            name="url"
            type="url"
            required
            value={url}
            placeholder="https://example.com"
            error={duplicatePinId ? undefined : errors?.url?.join('. ')}
            class={duplicatePinId ? 'border-red-500' : undefined}
            helpText="Enter the web address you want to save as a pin"
            data-url-input
            hx-get="/api/internal/check-url"
            hx-trigger="change"
            hx-target="#url-check-result"
            hx-swap="innerHTML"
            hx-params="url,exclude,baseUrl"
            hx-vals={JSON.stringify(
              pinId ? { baseUrl, exclude: pinId } : { baseUrl }
            )}
          />
          <div id="url-check-result">
            {duplicatePinId && (
              <p
                class="text-sm text-destructive font-medium"
                data-url-duplicate
              >
                This URL is already saved.{' '}
                <a
                  href={`${baseUrl}/${duplicatePinId}/edit`}
                  class="underline hover:text-red-800 dark:hover:text-red-200"
                >
                  Edit instead?
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Title field */}
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="title">Title</Label>
            <button
              type="button"
              data-refresh-button
              class="h-8 px-2 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
              aria-label="Refresh metadata from URL"
              title="Refresh metadata from URL"
            >
              <RefreshIcon size={24} class="h-4 w-4" data-refresh-icon />
            </button>
          </div>
          <Input
            id="title"
            name="title"
            type="text"
            required
            value={title}
            placeholder="Enter a title"
            error={errors?.title?.join('. ')}
            helpText="A descriptive title for your pin"
            data-title-input
          />
        </div>

        {/* Description field */}
        <div class="space-y-2">
          <Label for="description">Description (optional)</Label>
          <Textarea
            id="description"
            name="description"
            value={description}
            placeholder="Add a description..."
            helpText="Optional notes or context about this pin"
            data-description-input
          />
        </div>

        {/* Tags field */}
        <TagInput
          id="tags"
          name="tags"
          initialTags={
            tags
              ? tags
                  .split(',')
                  .map(t => t.trim())
                  .filter(t => t)
              : []
          }
          allTags={userTags}
          error={errors?.tagNames?.join('. ')}
        />

        {/* Read Later checkbox */}
        <Checkbox
          id="readLater"
          name="readLater"
          checked={readLater}
          label="Read Later"
          helpText="Mark this pin to read later"
        />

        {/* Private checkbox */}
        <Checkbox
          id="isPrivate"
          name="isPrivate"
          checked={isPrivate}
          label="Private"
          helpText="Hide this pin from the normal view"
        />

        {/* Submit button */}
        <div class="pt-4">
          <Button type="submit" class="w-full">
            {submitLabel}
          </Button>
        </div>
      </form>

      {/* Created date - only shown on edit */}
      {createdDate && (
        <div class="mt-4 text-sm text-muted-foreground">
          Originally pinned on {createdDate}
        </div>
      )}
    </div>
  )
}
