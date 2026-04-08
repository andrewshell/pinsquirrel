import type { FC } from 'hono/jsx'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { Checkbox } from './ui/Checkbox'
import { Label } from './ui/Label'
import { TagInput } from './TagInput'
import { ErrorMessage } from './FlashMessage'

interface PinFormProps {
  action: string
  submitLabel: string
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

        {/* URL field */}
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
            helpText="Enter the web address you want to save as a pin"
            data-url-input
            hx-get="/api/check-url"
            hx-trigger="change"
            hx-target="#url-check-result"
            hx-swap="innerHTML"
            hx-params="url"
            hx-vals={pinId ? JSON.stringify({ exclude: pinId }) : undefined}
          />
          <div id="url-check-result">
            {duplicatePinId && (
              <p class="text-sm text-destructive font-medium">
                This URL is already saved.{' '}
                <a
                  href={`/pins/${duplicatePinId}/edit`}
                  class="underline hover:text-red-800 dark:hover:text-red-200"
                >
                  Edit instead?
                </a>
              </p>
            )}
            {duplicatePinId && (
              <script
                dangerouslySetInnerHTML={{
                  __html: `document.getElementById('url').classList.add('border-red-500')`,
                }}
              />
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
              <svg
                data-refresh-icon
                class="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
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
                  .map((t) => t.trim())
                  .filter((t) => t)
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
