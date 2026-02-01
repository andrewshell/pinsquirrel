import type { FC } from 'hono/jsx'
import type { Pin, User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Checkbox } from '../components/ui/Checkbox'
import { Label } from '../components/ui/Label'
import { TagInput } from '../components/TagInput'
import { FlashMessage, ErrorMessage } from '../components/FlashMessage'
import type { FlashType } from '../../middleware/session'

interface PinEditPageProps {
  user: User
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
  user,
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
    <DefaultLayout title="Edit Pin" user={user}>
      <div class="py-8 px-4">
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
          <Card>
            <CardHeader>
              <CardTitle>Edit Pin</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                method="post"
                action={`/pins/${pin.id}/edit`}
                class="space-y-4"
                novalidate
                data-metadata-fetch
              >
                {/* Form-level errors */}
                {errors?._form && (
                  <ErrorMessage message={errors._form.join('. ')} />
                )}

                {/* URL field */}
                <div class="space-y-2">
                  <Label for="url" required>
                    URL
                  </Label>
                  <Input
                    id="url"
                    name="url"
                    type="url"
                    required
                    value={formUrl}
                    placeholder="https://example.com"
                    error={errors?.url?.join('. ')}
                    helpText="Enter the web address you want to save as a pin"
                    data-url-input
                  />
                </div>

                {/* Title field */}
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <Label for="title" required>
                      Title
                    </Label>
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
                    value={formTitle}
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
                    value={formDescription}
                    placeholder="Add a description..."
                    helpText="Optional notes or context about this pin"
                    data-description-input
                  />
                </div>

                {/* Tags field - vanilla JS component */}
                <TagInput
                  id="tags"
                  name="tags"
                  initialTags={
                    formTags
                      ? formTags
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
                  checked={formReadLater}
                  label="Read Later"
                  helpText="Mark this pin to read later"
                />

                {/* Submit button */}
                <div class="pt-4">
                  <Button type="submit" class="w-full">
                    Update Pin
                  </Button>
                </div>
              </form>

              {/* Created date */}
              <div class="mt-4 text-sm text-muted-foreground">
                Originally pinned on {createdDate}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DefaultLayout>
  )
}
