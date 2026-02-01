import type { FC } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { FlashMessage } from '../components/FlashMessage'
import { PinForm } from '../components/PinForm'
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
    <DefaultLayout
      title="Create New Pin"
      user={user}
      currentPath="/pins/new"
      width="form"
    >
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
          <PinForm
            action="/pins/new"
            submitLabel="Create Pin"
            url={url}
            title={title}
            description={description}
            readLater={readLater}
            tags={tags}
            userTags={userTags}
            errors={errors}
          />
        </CardContent>
      </Card>
    </DefaultLayout>
  )
}
