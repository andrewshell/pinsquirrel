import type { FC } from 'hono/jsx'
import type { Pin } from '@pinsquirrel/domain'
import { BaseLayout } from '../layouts/base'
import type { FlashType } from '../../middleware/session'

interface PinEditPageProps {
  pin: Pin
  errors?: Record<string, string[]>
  flash?: { type: FlashType; message: string } | null
  userTags?: string[]
  // Form values (for re-rendering after validation error)
  url?: string
  title?: string
  description?: string
  readLater?: boolean
  tags?: string
  // Query params to preserve on redirect
  returnParams?: string
}

export const PinEditPage: FC<PinEditPageProps> = ({
  pin,
  errors,
  flash,
  userTags = [],
  url,
  title,
  description,
  readLater,
  tags,
  returnParams = '',
}) => {
  // Use form values if provided (after validation error), otherwise use pin values
  const formUrl = url ?? pin.url
  const formTitle = title ?? pin.title
  const formDescription = description ?? (pin.description || '')
  const formReadLater = readLater ?? pin.readLater
  const formTags = tags ?? pin.tagNames.join(', ')

  const backUrl = returnParams ? `/pins?${returnParams}` : '/pins'

  // Format created date
  const createdDate = new Date(pin.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <BaseLayout title="Edit Pin">
      <div class="min-h-screen py-8 px-4">
        <div class="max-w-2xl mx-auto">
          {/* Back link */}
          <div class="mb-6">
            <a
              href={backUrl}
              class="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              ← Back to Pins
            </a>
          </div>

          {/* Flash message */}
          {flash && (
            <div
              class={`mb-4 p-3 text-sm border-2 neobrutalism-shadow ${
                flash.type === 'success'
                  ? 'text-green-700 bg-green-50 border-green-200'
                  : flash.type === 'error'
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : flash.type === 'warning'
                      ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                      : 'text-blue-700 bg-blue-50 border-blue-200'
              }`}
            >
              {flash.message}
            </div>
          )}

          {/* Form Card */}
          <div class="bg-card border-2 border-foreground neobrutalism-shadow p-6">
            <h1 class="text-2xl font-bold mb-6">Edit Pin</h1>

            <form
              method="post"
              action={`/pins/${pin.id}/edit`}
              class="space-y-4"
              novalidate
            >
              {/* Form-level errors */}
              {errors?._form && (
                <div class="p-3 text-sm text-red-700 bg-red-50 border-2 border-red-200 neobrutalism-shadow">
                  {errors._form.join('. ')}
                </div>
              )}

              {/* URL field */}
              <div class="space-y-2">
                <label for="url" class="block text-sm font-medium">
                  URL <span class="text-red-500">*</span>
                </label>
                <input
                  id="url"
                  name="url"
                  type="url"
                  required
                  value={formUrl}
                  placeholder="https://example.com"
                  aria-invalid={errors?.url ? 'true' : undefined}
                  aria-describedby="url-help"
                  class={`w-full px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                         ${errors?.url ? 'border-red-500' : ''}`}
                />
                <p id="url-help" class="text-xs text-muted-foreground">
                  Enter the web address you want to save as a pin
                </p>
                {errors?.url && (
                  <p class="text-sm text-red-600 font-medium">
                    {errors.url.join('. ')}
                  </p>
                )}
              </div>

              {/* Title field */}
              <div class="space-y-2">
                <label for="title" class="block text-sm font-medium">
                  Title <span class="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  value={formTitle}
                  placeholder="Enter a title"
                  aria-invalid={errors?.title ? 'true' : undefined}
                  aria-describedby="title-help"
                  class={`w-full px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                         ${errors?.title ? 'border-red-500' : ''}`}
                />
                <p id="title-help" class="text-xs text-muted-foreground">
                  A descriptive title for your pin
                </p>
                {errors?.title && (
                  <p class="text-sm text-red-600 font-medium">
                    {errors.title.join('. ')}
                  </p>
                )}
              </div>

              {/* Description field */}
              <div class="space-y-2">
                <label for="description" class="block text-sm font-medium">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Add a description..."
                  aria-describedby="description-help"
                  class="w-full px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  {formDescription}
                </textarea>
                <p id="description-help" class="text-xs text-muted-foreground">
                  Optional notes or context about this pin
                </p>
              </div>

              {/* Tags field */}
              <div class="space-y-2">
                <label for="tags" class="block text-sm font-medium">
                  Tags (optional)
                </label>
                <input
                  id="tags"
                  name="tags"
                  type="text"
                  value={formTags}
                  placeholder="Enter tags separated by commas"
                  aria-describedby="tags-help"
                  class="w-full px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
                <p id="tags-help" class="text-xs text-muted-foreground">
                  Add tags separated by commas (e.g., "javascript, tutorial,
                  react")
                </p>
                {errors?.tagNames && (
                  <p class="text-sm text-red-600 font-medium">
                    {errors.tagNames.join('. ')}
                  </p>
                )}
                {/* Show existing tags for reference */}
                {userTags.length > 0 && (
                  <div class="mt-2">
                    <p class="text-xs text-muted-foreground mb-1">
                      Your existing tags:
                    </p>
                    <div class="flex flex-wrap gap-1">
                      {userTags.slice(0, 20).map((tag) => (
                        <span class="text-xs px-2 py-0.5 bg-accent/10 text-accent border border-accent/30">
                          {tag}
                        </span>
                      ))}
                      {userTags.length > 20 && (
                        <span class="text-xs text-muted-foreground">
                          +{userTags.length - 20} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Read Later checkbox */}
              <div class="space-y-2">
                <div class="flex items-center space-x-2">
                  <input type="hidden" name="readLater" value="false" />
                  <input
                    id="readLater"
                    name="readLater"
                    type="checkbox"
                    value="true"
                    checked={formReadLater}
                    class="h-4 w-4 border-2 border-foreground bg-background
                           focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                  <label for="readLater" class="text-sm font-medium">
                    Read Later
                  </label>
                </div>
                <p class="text-xs text-muted-foreground ml-6">
                  Mark this pin to read later
                </p>
              </div>

              {/* Submit button */}
              <div class="pt-4">
                <button
                  type="submit"
                  class="w-full px-4 py-2 bg-primary text-primary-foreground font-medium
                         border-2 border-foreground neobrutalism-shadow
                         hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                         active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                         transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Pin
                </button>
              </div>
            </form>

            {/* Created date */}
            <div class="mt-4 text-sm text-muted-foreground">
              Originally pinned on {createdDate}
            </div>
          </div>
        </div>
      </div>
    </BaseLayout>
  )
}
