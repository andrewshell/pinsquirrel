import type { FC } from 'hono/jsx'
import type { Pin, User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { FlashMessage } from '../components/FlashMessage'
import { PinForm } from '../components/PinForm'
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

  return (
    <DefaultLayout title="Edit Pin" user={user} width="form">
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
          <PinForm
            action={`/pins/${pin.id}/edit`}
            submitLabel="Update Pin"
            url={formUrl}
            title={formTitle}
            description={formDescription}
            readLater={formReadLater}
            tags={formTags}
            userTags={userTags}
            errors={errors}
            createdAt={pin.createdAt}
          />
        </CardContent>
      </Card>
    </DefaultLayout>
  )
}
