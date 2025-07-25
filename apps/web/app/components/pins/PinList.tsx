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
    >
      <div className="space-y-3">
        {/* Title skeleton */}
        <div className="h-4 bg-muted rounded w-3/4"></div>
        
        {/* URL skeleton */}
        <div className="h-3 bg-muted rounded w-1/2"></div>
        
        {/* Description skeleton */}
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded"></div>
          <div className="h-3 bg-muted rounded w-5/6"></div>
        </div>
        
        {/* Tags skeleton */}
        <div className="flex gap-2">
          <div className="h-6 bg-muted rounded-full w-16"></div>
          <div className="h-6 bg-muted rounded-full w-20"></div>
        </div>
        
        {/* Date skeleton */}
        <div className="h-3 bg-muted rounded w-1/3"></div>
      </div>
    </div>
  )
}

export function PinList({ pins, isLoading }: PinListProps) {
  // Show loading state with skeleton cards
  if (isLoading) {
    return (
      <div data-testid="pin-list-loading">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <PinSkeleton key={index} index={index} />
          ))}
        </div>
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
    >
      {pins.map((pin) => (
        <PinCard key={pin.id} pin={pin} />
      ))}
    </div>
  )
}