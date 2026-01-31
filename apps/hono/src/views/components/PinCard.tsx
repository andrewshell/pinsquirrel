import type { FC } from 'hono/jsx'
import type { Pin } from '@pinsquirrel/domain'

interface PinCardProps {
  pin: Pin
  viewSize?: 'expanded' | 'compact'
  searchParams?: string
}

// Format relative time
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  )
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInHours < 1) return 'just now'
  if (diffInHours < 24)
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  if (diffInDays === 1) return 'yesterday'
  if (diffInDays < 7) return `${diffInDays} days ago`
  if (diffInDays < 30)
    return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) > 1 ? 's' : ''} ago`
  return `${Math.floor(diffInDays / 30)} month${Math.floor(diffInDays / 30) > 1 ? 's' : ''} ago`
}

// Extract domain from URL
function getDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

// Build tag filter URL
function buildTagUrl(tagName: string, currentParams: string): string {
  const params = new URLSearchParams(currentParams)
  params.set('tag', tagName)
  return `/pins?${params.toString()}`
}

// Build action URL preserving query params
function buildActionUrl(
  pinId: string,
  action: 'edit' | 'delete',
  searchParams: string
): string {
  return `/pins/${pinId}/${action}${searchParams ? `?${searchParams}` : ''}`
}

export const PinCard: FC<PinCardProps> = ({
  pin,
  viewSize = 'expanded',
  searchParams = '',
}) => {
  // Compact view rendering
  if (viewSize === 'compact') {
    return (
      <div
        class="py-1 hover:bg-accent/5 transition-all"
        id={`pin-${pin.id}`}
        role="article"
      >
        <div class="flex-1 min-w-0">
          {/* Single line with left and right sections */}
          <div class="flex items-baseline gap-2 text-sm justify-between">
            {/* Left: Title, Domain, Tags */}
            <div class="flex items-baseline gap-2 flex-wrap flex-1 min-w-0">
              {/* Title */}
              <h3 class="inline">
                <a
                  href={pin.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class={`text-accent hover:text-accent/80 ${pin.readLater ? 'font-bold' : ''}`}
                >
                  {pin.readLater && '• '}
                  {pin.title}
                </a>
              </h3>

              {/* Domain only */}
              <span class="text-muted-foreground">({getDomain(pin.url)})</span>

              {/* Tags */}
              {pin.tagNames.length > 0 && (
                <span class="text-muted-foreground">
                  {pin.tagNames.map((tagName, index) => (
                    <>
                      <a
                        href={buildTagUrl(tagName, searchParams)}
                        class="text-accent hover:text-accent/80 hover:underline"
                      >
                        {tagName}
                      </a>
                      {index < pin.tagNames.length - 1 && <span>, </span>}
                    </>
                  ))}
                </span>
              )}
            </div>

            {/* Right: Actions */}
            <div class="flex gap-2 text-muted-foreground flex-shrink-0">
              <a
                href={buildActionUrl(pin.id, 'edit', searchParams)}
                class="text-accent hover:text-accent/80 font-bold hover:underline"
              >
                edit
              </a>
              <a
                href={buildActionUrl(pin.id, 'delete', searchParams)}
                class="text-destructive hover:text-destructive/80 font-bold hover:underline"
              >
                delete
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Expanded view rendering (default)
  return (
    <div
      class="py-2 hover:bg-accent/5 transition-all"
      id={`pin-${pin.id}`}
      role="article"
    >
      {/* Main content */}
      <div class="flex-1 min-w-0">
        {/* Title as link */}
        <h3 class="mb-1">
          <a
            href={pin.url}
            target="_blank"
            rel="noopener noreferrer"
            class={`text-accent hover:text-accent/80 text-base ${pin.readLater ? 'font-bold' : ''}`}
          >
            {pin.readLater && '• '}
            {pin.title}
          </a>
        </h3>

        {/* URL as link */}
        <div class="text-sm mb-1">
          <a
            href={pin.url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-muted-foreground hover:text-foreground break-all"
          >
            {pin.url}
          </a>
        </div>

        {/* Description (if exists) */}
        {pin.description && (
          <div class="text-sm text-muted-foreground mb-2">
            {pin.description}
          </div>
        )}

        {/* Tags */}
        {pin.tagNames.length > 0 && (
          <div class="text-sm text-muted-foreground mb-2">
            {pin.tagNames.map((tagName, index) => (
              <>
                <a
                  href={buildTagUrl(tagName, searchParams)}
                  class="text-accent hover:text-accent/80 hover:underline cursor-pointer"
                >
                  {tagName}
                </a>
                {index < pin.tagNames.length - 1 && <span>, </span>}
              </>
            ))}
          </div>
        )}

        {/* Bottom row: Timestamp and Actions */}
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          {/* Timestamp */}
          <span class="font-bold">{getRelativeTime(pin.createdAt)}</span>

          {/* Actions */}
          <div class="flex gap-2">
            <a
              href={buildActionUrl(pin.id, 'edit', searchParams)}
              class="text-accent hover:text-accent/80 font-bold hover:underline"
            >
              edit
            </a>
            <a
              href={buildActionUrl(pin.id, 'delete', searchParams)}
              class="text-destructive hover:text-destructive/80 font-bold hover:underline"
            >
              delete
            </a>

            {/* Mark as Read action - only show for read-later pins */}
            {pin.readLater && (
              <button
                type="button"
                class="text-accent hover:text-accent/80 font-bold hover:underline"
                hx-post={`/pins/${pin.id}/toggle-read`}
                hx-swap="outerHTML"
                hx-target={`#pin-${pin.id}`}
              >
                mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
