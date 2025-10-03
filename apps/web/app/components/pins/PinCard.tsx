import { Link, useFetcher, useLocation } from 'react-router'
import type { Pin } from '@pinsquirrel/domain'

interface PinCardProps {
  pin: Pin
  viewSize?: 'expanded' | 'compact'
}

// Type guard for mark as read response
function isMarkAsReadResponse(
  data: unknown
): data is { success: boolean; readLater: boolean } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    'readLater' in data &&
    typeof (data as { success: unknown; readLater: unknown }).success ===
      'boolean' &&
    typeof (data as { success: unknown; readLater: unknown }).readLater ===
      'boolean'
  )
}

export function PinCard({ pin, viewSize = 'expanded' }: PinCardProps) {
  const markAsReadFetcher = useFetcher()
  const location = useLocation()

  // Build URL with preserved query parameters for edit/delete links
  const buildActionUrl = (action: 'edit' | 'delete') => {
    return `/pins/${pin.id}/${action}${location.search}`
  }

  // Determine optimistic pin state
  const isMarking = markAsReadFetcher.state === 'submitting'
  const markAsReadResponse = isMarkAsReadResponse(markAsReadFetcher.data)
    ? markAsReadFetcher.data
    : null
  const hasBeenMarked =
    markAsReadResponse?.success && markAsReadResponse.readLater === false
  const optimisticReadLater = isMarking || hasBeenMarked ? false : pin.readLater

  // Format relative time (simplified for now)
  const getRelativeTime = (date: Date) => {
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

  // Extract domain from URL for compact view
  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return url
    }
  }

  // Compact view rendering
  if (viewSize === 'compact') {
    return (
      <div
        className="py-1 hover:bg-accent/5 transition-all"
        role="article"
        aria-labelledby={`pin-title-${pin.id}`}
      >
        <div className="flex-1 min-w-0">
          {/* Single line with left and right sections */}
          <div className="flex items-baseline gap-2 text-sm justify-between">
            {/* Left: Title, Domain, Tags */}
            <div className="flex items-baseline gap-2 flex-wrap flex-1 min-w-0">
              {/* Title */}
              <h3 id={`pin-title-${pin.id}`} className="inline">
                <a
                  href={pin.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-accent hover:text-accent/80 ${optimisticReadLater ? 'font-bold' : ''}`}
                >
                  {optimisticReadLater && '• '}
                  {pin.title}
                </a>
              </h3>

              {/* Domain only */}
              <span className="text-muted-foreground">
                ({getDomain(pin.url)})
              </span>

              {/* Tags */}
              {pin.tagNames.length > 0 && (
                <span
                  className="text-muted-foreground"
                  data-testid="pin-tags"
                  role="list"
                  aria-label={`Tags: ${pin.tagNames.join(', ')}`}
                >
                  {pin.tagNames.map((tagName, index) => {
                    const params = new URLSearchParams(location.search)
                    params.set('tag', tagName)
                    const tagUrl = `/pins?${params.toString()}`

                    return (
                      <span key={tagName} role="listitem">
                        <Link
                          to={tagUrl}
                          className="text-accent hover:text-accent/80 hover:underline"
                          aria-label={`Filter by tag: ${tagName}`}
                        >
                          {tagName}
                        </Link>
                        {index < pin.tagNames.length - 1 && <span>, </span>}
                      </span>
                    )
                  })}
                </span>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex gap-2 text-muted-foreground flex-shrink-0">
              <Link
                to={buildActionUrl('edit')}
                className="text-accent hover:text-accent/80 font-bold hover:underline"
                aria-label={`Edit ${pin.title}`}
              >
                edit
              </Link>
              <Link
                to={buildActionUrl('delete')}
                className="text-destructive hover:text-destructive/80 font-bold hover:underline"
                aria-label={`Delete ${pin.title}`}
              >
                delete
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Expanded view rendering (default)
  return (
    <div
      className="py-2 hover:bg-accent/5 transition-all"
      role="article"
      aria-labelledby={`pin-title-${pin.id}`}
    >
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Title as link */}
        <h3 id={`pin-title-${pin.id}`} className="mb-1">
          <a
            href={pin.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-accent hover:text-accent/80 text-base ${optimisticReadLater ? 'font-bold' : ''}`}
          >
            {optimisticReadLater && '• '}
            {pin.title}
          </a>
        </h3>

        {/* URL as link */}
        <div className="text-sm mb-1">
          <a
            href={pin.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground break-all"
          >
            {pin.url}
          </a>
        </div>

        {/* Description (if exists) */}
        {pin.description && (
          <div
            data-testid="pin-description"
            className="text-sm text-muted-foreground mb-2"
          >
            {pin.description}
          </div>
        )}

        {/* Tags */}
        {pin.tagNames.length > 0 && (
          <div
            className="text-sm text-muted-foreground mb-2"
            data-testid="pin-tags"
            role="list"
            aria-label={`Tags: ${pin.tagNames.join(', ')}`}
          >
            {pin.tagNames.map((tagName, index) => {
              // Build URL with tag filter and preserve current unread filter
              const params = new URLSearchParams(location.search)
              params.set('tag', tagName)
              const tagUrl = `/pins?${params.toString()}`

              return (
                <span key={tagName} role="listitem">
                  <Link
                    to={tagUrl}
                    className="text-accent hover:text-accent/80 hover:underline cursor-pointer"
                    aria-label={`Filter by tag: ${tagName}`}
                  >
                    {tagName}
                  </Link>
                  {index < pin.tagNames.length - 1 && <span>, </span>}
                </span>
              )
            })}
          </div>
        )}

        {/* Bottom row: Timestamp and Actions */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {/* Timestamp */}
          <span className="font-bold">{getRelativeTime(pin.createdAt)}</span>

          {/* Actions */}
          <div
            className="flex gap-2"
            role="group"
            aria-label={`Actions for ${pin.title}`}
          >
            <Link
              to={buildActionUrl('edit')}
              className="text-accent hover:text-accent/80 font-bold hover:underline"
              aria-label={`Edit ${pin.title}`}
            >
              edit
            </Link>
            <Link
              to={buildActionUrl('delete')}
              className="text-destructive hover:text-destructive/80 font-bold hover:underline"
              aria-label={`Delete ${pin.title}`}
            >
              delete
            </Link>

            {/* Mark as Read action - only show for read-later pins */}
            {optimisticReadLater && (
              <markAsReadFetcher.Form
                method="patch"
                action={`/pins/${pin.id}/edit`}
                style={{ display: 'inline' }}
              >
                <input type="hidden" name="readLater" value="false" />
                <button
                  type="submit"
                  className="text-accent hover:text-accent/80 font-bold hover:underline"
                  aria-label={`Mark ${pin.title} as read`}
                  disabled={isMarking}
                >
                  {isMarking ? 'marking...' : 'mark as read'}
                </button>
              </markAsReadFetcher.Form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
