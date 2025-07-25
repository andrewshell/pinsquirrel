import type { Pin } from '@pinsquirrel/core'

interface PinCardProps {
  pin: Pin
}

export function PinCard({ pin }: PinCardProps) {
  // Format relative time (simplified for now)
  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInHours / 24)
    
    if (diffInHours < 1) return 'just now'
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    if (diffInDays === 1) return 'yesterday'
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) > 1 ? 's' : ''} ago`
    return `${Math.floor(diffInDays / 30)} month${Math.floor(diffInDays / 30) > 1 ? 's' : ''} ago`
  }

  return (
    <div 
      className="py-1"
      role="article" 
      aria-labelledby={`pin-title-${pin.id}`}
    >
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Title as link */}
        <h3 
          id={`pin-title-${pin.id}`}
          className="mb-0.5"
        >
          <a
            href={pin.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 font-normal"
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
            className="text-muted-foreground hover:text-blue-600"
          >
            {pin.url}
          </a>
        </div>

        {/* Description (if exists) */}
        {pin.description && (
          <div 
            data-testid="pin-description"
            className="text-xs text-muted-foreground mb-1"
          >
            {pin.description}
          </div>
        )}

        {/* Tags */}
        {pin.tags.length > 0 && (
          <div 
            className="flex flex-wrap gap-1 mb-1" 
            data-testid="pin-tags"
            role="list"
            aria-label={`Tags: ${pin.tags.map(t => t.name).join(', ')}`}
          >
            {pin.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-xs text-orange-600 hover:text-orange-800 cursor-pointer"
                role="listitem"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Bottom row: Timestamp and Actions */}
        <div 
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          {/* Timestamp */}
          <span>
            {getRelativeTime(pin.createdAt)}
          </span>

          {/* Actions */}
          <div 
            className="flex gap-2"
            role="group"
            aria-label={`Actions for ${pin.title}`}
          >
            <button
              className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
              aria-label={`Edit ${pin.title}`}
            >
              edit
            </button>
            <button
              className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
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