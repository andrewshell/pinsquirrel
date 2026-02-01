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
                  />
                </div>

                {/* Title field */}
                <div class="space-y-2">
                  <Label for="title" required>
                    Title
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    type="text"
                    required
                    value={formTitle}
                    placeholder="Enter a title"
                    error={errors?.title?.join('. ')}
                    helpText="A descriptive title for your pin"
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
