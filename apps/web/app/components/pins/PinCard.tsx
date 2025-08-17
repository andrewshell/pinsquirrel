import { useState } from 'react'
import { Link, useFetcher } from 'react-router'
import type { Pin } from '@pinsquirrel/core'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'

interface PinCardProps {
  pin: Pin
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

export function PinCard({ pin }: PinCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const markAsReadFetcher = useFetcher()

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
        <div className="text-xs mb-1">
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
        {pin.tags.length > 0 && (
          <div
            className="text-sm text-muted-foreground mb-2"
            data-testid="pin-tags"
            role="list"
            aria-label={`Tags: ${pin.tags.map(t => t.name).join(', ')}`}
          >
            {pin.tags.map((tag, index) => (
              <span key={tag.id} role="listitem">
                <button
                  className="text-accent hover:text-accent/80 hover:underline cursor-pointer"
                  aria-label={`Filter by tag: ${tag.name}`}
                >
                  {tag.name}
                </button>
                {index < pin.tags.length - 1 && <span>, </span>}
              </span>
            ))}
          </div>
        )}

        {/* Bottom row: Timestamp and Actions */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {/* Timestamp */}
          <span className="font-bold">{getRelativeTime(pin.createdAt)}</span>

          {/* Actions */}
          <div
            className="flex gap-2"
            role="group"
            aria-label={`Actions for ${pin.title}`}
          >
            <Link
              to={`/pins/${pin.id}/edit`}
              className="text-accent hover:text-accent/80 font-bold hover:underline"
              aria-label={`Edit ${pin.title}`}
            >
              edit
            </Link>
            <button
              type="button"
              className="text-destructive hover:text-destructive/80 font-bold hover:underline"
              aria-label={`Delete ${pin.title}`}
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              delete
            </button>
            
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        pin={pin}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </div>
  )
}
