import type { FC } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
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

interface PinNewPageProps {
  user: User
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
  user,
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
    <DefaultLayout title="Create New Pin" user={user} currentPath="/pins/new">
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
              <CardTitle>Create New Pin</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                method="post"
                action="/pins/new"
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
                    value={url}
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
                    value={title}
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
                    value={description}
                    placeholder="Add a description..."
                    helpText="Optional notes or context about this pin"
                  />
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
                <Checkbox
                  id="readLater"
                  name="readLater"
                  checked={readLater}
                  label="Read Later"
                  helpText="Mark this pin to read later"
                />

                {/* Submit button */}
                <div class="pt-4">
                  <Button type="submit" class="w-full">
                    Create Pin
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DefaultLayout>
  )
}
