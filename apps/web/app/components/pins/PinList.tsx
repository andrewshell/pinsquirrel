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
      className="bg-card rounded-lg border p-4 animate-pulse"
      role="status"
      aria-label={`Loading pin ${index + 1}`}
    >
      <div className="space-y-3">
        {/* Title skeleton */}
        <div className="h-4 bg-muted rounded w-3/4" aria-hidden="true"></div>
        
        {/* URL skeleton */}
        <div className="h-3 bg-muted rounded w-1/2" aria-hidden="true"></div>
        
        {/* Description skeleton */}
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded" aria-hidden="true"></div>
          <div className="h-3 bg-muted rounded w-5/6" aria-hidden="true"></div>
        </div>
        
        {/* Tags skeleton */}
        <div className="flex gap-2">
          <div className="h-6 bg-muted rounded-full w-16" aria-hidden="true"></div>
          <div className="h-6 bg-muted rounded-full w-20" aria-hidden="true"></div>
        </div>
        
        {/* Date skeleton */}
        <div className="h-3 bg-muted rounded w-1/3" aria-hidden="true"></div>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

  // Show pins in responsive grid
  return (
    <div 
      data-testid="pin-list-grid"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      role="region"
      aria-label={`${pins.length} pins`}
    >
      {pins.map((pin) => (
        <PinCard key={pin.id} pin={pin} />
      ))}
    </div>
  )
}