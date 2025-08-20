import { X } from 'lucide-react'
import { useLocation, Link } from 'react-router'

interface TagFilterHeaderProps {
  activeTag: string
  className?: string
}

export function TagFilterHeader({
  activeTag,
  className,
}: TagFilterHeaderProps) {
  const location = useLocation()

  // Build URL to remove tag filter while preserving other parameters
  const buildRemoveTagLink = () => {
    const params = new URLSearchParams(location.search)
    params.delete('tag')

    const queryString = params.toString()
    const basePath = location.pathname
    return `${basePath}${queryString ? `?${queryString}` : ''}`
  }

  return (
    <div className={`flex items-center ${className}`}>
      <div className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
        <span>{activeTag}</span>
        <button
          type="button"
          className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-foreground"
          aria-label={`Remove ${activeTag} tag filter`}
        >
          <Link to={buildRemoveTagLink()}>
            <X className="h-3 w-3" />
          </Link>
        </button>
      </div>
    </div>
  )
}
