import type { Pin } from '@pinsquirrel/core'
import { Edit, Trash2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'

interface PinCardProps {
  pin: Pin
}

export function PinCard({ pin }: PinCardProps) {
  // Extract domain from URL
  const getDomain = (url: string) => {
    try {
      const { hostname } = new URL(url)
      return hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  return (
    <Card className="group relative">
      <CardContent className="p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className="text-lg font-medium mb-1 truncate">
              {pin.title}
            </h3>

            {/* URL */}
            <p className="text-sm text-muted-foreground mb-3">
              {getDomain(pin.url)}
            </p>

            {/* Description */}
            <p
              data-testid="pin-description"
              className="text-sm text-muted-foreground line-clamp-3 mb-4"
            >
              {pin.description || 'No description'}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2" data-testid="pin-tags">
              {pin.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Edit pin"
              className="h-8 w-8"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Delete pin"
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}