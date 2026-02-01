import type { FC } from 'hono/jsx'
import { BaseLayout } from '../layouts/base'
import { TagInput } from '../components/TagInput'
import { FlashMessage, ErrorMessage } from '../components/FlashMessage'
import type { FlashType } from '../../middleware/session'

interface PinNewPageProps {
  errors?: Record<string, string[]>
  flash?: { type: FlashType; message: string } | null
  userTags?: string[]
  // Pre-populated values (from bookmarklet or form resubmission)
  url?: string
  title?: string
  description?: string
  readLater?: boolean
  tags?: string
  // Query params to preserve on redirect
  returnParams?: string
}

export const PinNewPage: FC<PinNewPageProps> = ({
  errors,
  flash,
  userTags = [],
  url = '',
  title = '',
  description = '',
  readLater = false,
  tags = '',
  returnParams = '',
}) => {
  const backUrl = returnParams ? `/pins?${returnParams}` : '/pins'

  return (
    <BaseLayout title="Create New Pin">
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
            <FlashMessage
              type={flash.type}
              message={flash.message}
              className="mb-4"
            />
          )}

          {/* Form Card */}
          <div class="bg-card border-2 border-foreground neobrutalism-shadow p-6">
            <h1 class="text-2xl font-bold mb-6">Create New Pin</h1>

            <form method="post" action="/pins/new" class="space-y-4" novalidate>
              {/* Form-level errors */}
              {errors?._form && (
                <ErrorMessage message={errors._form.join('. ')} />
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
                  value={url}
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
                  value={title}
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
                  {description}
                </textarea>
                <p id="description-help" class="text-xs text-muted-foreground">
                  Optional notes or context about this pin
                </p>
              </div>

              {/* Tags field - vanilla JS component */}
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
              <div class="space-y-2">
                <div class="flex items-center space-x-2">
                  <input type="hidden" name="readLater" value="false" />
                  <input
                    id="readLater"
                    name="readLater"
                    type="checkbox"
                    value="true"
                    checked={readLater}
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
                  Create Pin
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </BaseLayout>
  )
}
