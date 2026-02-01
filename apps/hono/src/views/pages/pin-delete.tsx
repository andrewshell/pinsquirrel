import type { FC } from 'hono/jsx'
import type { Pin, User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'

interface PinDeletePageProps {
  user: User
  pin: Pin
}

export const PinDeletePage: FC<PinDeletePageProps> = ({ user, pin }) => {
  return (
    <DefaultLayout title="Delete Pin" user={user} width="form">
      {/* Back link */}
      <div class="mb-6">
        <a
          href="/pins"
          class="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← Back to Pins
        </a>
      </div>

      {/* Delete confirmation card */}
      <div class="bg-card border-2 border-foreground neobrutalism-shadow p-6">
        <h1 class="text-2xl font-bold mb-4 text-red-600">Delete Pin</h1>

        <p class="text-muted-foreground mb-6">
          Are you sure you want to delete this pin? This action cannot be
          undone.
        </p>

        {/* Pin preview */}
        <div class="bg-background border-2 border-foreground/20 p-4 mb-6">
          <h2 class="font-semibold text-lg mb-2">{pin.title}</h2>
          <a
            href={pin.url}
            class="text-sm text-accent hover:underline break-all"
            target="_blank"
            rel="noopener noreferrer"
          >
            {pin.url}
          </a>
          {pin.description && (
            <p class="text-sm text-muted-foreground mt-2">{pin.description}</p>
          )}
          {pin.tagNames.length > 0 && (
            <div class="flex flex-wrap gap-1 mt-3">
              {pin.tagNames.map((tag) => (
                <span class="text-xs px-2 py-0.5 bg-accent/10 text-accent border border-accent/30">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div class="flex gap-4">
          <a
            href="/pins"
            class="flex-1 px-4 py-2 text-center bg-background text-foreground font-medium
                   border-2 border-foreground neobrutalism-shadow
                   hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                   active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                   transition-all"
          >
            Cancel
          </a>
          <form method="post" action={`/pins/${pin.id}/delete`} class="flex-1">
            <button
              type="submit"
              class="w-full px-4 py-2 bg-red-600 text-white font-medium
                     border-2 border-foreground neobrutalism-shadow
                     hover:bg-red-700 hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                     active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                     transition-all"
            >
              Delete Pin
            </button>
          </form>
        </div>
      </div>
    </DefaultLayout>
  )
}
