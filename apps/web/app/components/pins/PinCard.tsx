import { Link } from 'react-router'
import type { Pin } from '@pinsquirrel/core'

interface PinCardProps {
  pin: Pin
}

export function PinCard({ pin }: PinCardProps) {
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
            className="text-accent hover:text-accent/80 font-bold text-base"
          >
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
            className="flex flex-wrap gap-1 mb-2"
            data-testid="pin-tags"
            role="list"
            aria-label={`Tags: ${pin.tags.map(t => t.name).join(', ')}`}
          >
            {pin.tags.map(tag => (
              <span
                key={tag.id}
                className="text-xs text-secondary-foreground bg-secondary hover:bg-secondary/80 cursor-pointer px-2 py-0.5 font-bold"
                role="listitem"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Bottom row: Timestamp and Actions */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
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
              className="text-destructive hover:text-destructive/80 font-bold hover:underline"
              aria-label={`Delete ${pin.title}`}
            >
              delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
