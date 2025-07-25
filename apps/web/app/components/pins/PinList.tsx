import type { Pin } from '@pinsquirrel/core'
import { PinCard } from './PinCard'
import { EmptyState } from './EmptyState'

interface PinListProps {
  pins: Pin[]
  isLoading: boolean
}

function PinSkeleton({ index }: { index: number }) {
  return (
    <div 
      data-testid={`pin-skeleton-${index}`}
      className="py-1 animate-pulse"
      role="status"
      aria-label={`Loading pin ${index + 1}`}
    >
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title skeleton */}
        <div className="h-4 bg-muted rounded w-3/4" aria-hidden="true"></div>
        
        {/* URL skeleton */}
        <div className="h-3 bg-muted rounded w-2/3" aria-hidden="true"></div>
        
        {/* Tags skeleton */}
        <div className="flex gap-1">
          <div className="h-3 bg-muted rounded w-12" aria-hidden="true"></div>
          <div className="h-3 bg-muted rounded w-16" aria-hidden="true"></div>
        </div>

        {/* Bottom row skeleton - timestamp and actions */}
        <div className="flex items-center gap-2">
          <div className="h-3 bg-muted rounded w-16" aria-hidden="true"></div>
          <div className="h-3 bg-muted rounded w-8" aria-hidden="true"></div>
          <div className="h-3 bg-muted rounded w-12" aria-hidden="true"></div>
        </div>
      </div>
      <span className="sr-only">Loading pin content...</span>
    </div>
  )
}

export function PinList({ pins, isLoading }: PinListProps) {
  // Show loading state with skeleton cards
  if (isLoading) {
    return (
      <div 
        data-testid="pin-list-loading"
        role="status"
        aria-live="polite"
        aria-label="Loading pins"
      >
        <div className="space-y-4">
          {Array.from({ length: 6 }, (_, index) => (
            <PinSkeleton key={index} index={index} />
          ))}
        </div>
        <span className="sr-only">Loading your pins...</span>
      </div>
    )
  }

  // Show empty state when no pins
  if (pins.length === 0) {
    return <EmptyState />
  }

  // Show pins in vertical list
  return (
    <div 
      data-testid="pin-list"
      className="space-y-4"
      role="region"
      aria-label={`${pins.length} pins`}
    >
      {pins.map((pin) => (
        <PinCard key={pin.id} pin={pin} />
      ))}
    </div>
  )
}