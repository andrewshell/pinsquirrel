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
  isPrivate?: boolean
  tags?: string
  duplicatePinId?: string
  // Query params to preserve on redirect
  returnParams?: string
  baseUrl?: string
  privateMode?: boolean
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
  isPrivate = false,
  tags = '',
  duplicatePinId,
  returnParams = '',
  baseUrl = '/pins',
  privateMode = false,
}) => {
  const backUrl = returnParams ? `${baseUrl}?${returnParams}` : baseUrl

  return (
    <DefaultLayout
      title="Create New Pin"
      user={user}
      currentPath={`${baseUrl}/new`}
      width="form"
      privateMode={privateMode}
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
      <h1 class="sr-only">Create New Pin</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create New Pin</CardTitle>
        </CardHeader>
        <CardContent>
          <PinForm
            action={`${baseUrl}/new`}
            submitLabel="Create Pin"
            url={url}
            title={title}
            description={description}
            readLater={readLater}
            isPrivate={isPrivate}
            tags={tags}
            userTags={userTags}
            errors={errors}
            duplicatePinId={duplicatePinId}
          />
        </CardContent>
      </Card>
    </DefaultLayout>
  )
}
