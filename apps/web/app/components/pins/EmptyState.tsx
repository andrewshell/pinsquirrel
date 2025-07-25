import { Bookmark } from 'lucide-react'
import { Button } from '~/components/ui/button'

export function EmptyState() {
  return (
    <div
      data-testid="empty-state-container"
      className="text-center py-12 px-4"
      role="region"
      aria-labelledby="empty-state-heading"
    >
      <div className="mx-auto max-w-md">
        <div className="flex justify-center mb-6">
          <div
            data-testid="empty-state-icon"
            className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center"
            role="img"
            aria-label="Empty pin collection illustration"
          >
            <Bookmark className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
        </div>
        
        <h3 
          id="empty-state-heading"
          className="text-lg font-semibold mb-2"
        >
          You don&apos;t have any pins yet
        </h3>
        
        <p className="text-muted-foreground mb-6">
          Start saving your favorite links, images, and articles to build your personal library.
        </p>
        
        <Button aria-describedby="empty-state-heading">
          Create your first pin
        </Button>
      </div>
    </div>
  )
}