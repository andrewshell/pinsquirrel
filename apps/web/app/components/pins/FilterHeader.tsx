import { X, Search, Tag } from 'lucide-react'
import { useLocation, Link } from 'react-router'

interface FilterHeaderProps {
  activeTag?: string
  searchQuery?: string
  resultCount: number
  className?: string
}

export function FilterHeader({
  activeTag,
  searchQuery,
  resultCount,
  className,
}: FilterHeaderProps) {
  const location = useLocation()

  // Don't render if no filters are active
  const hasActiveTag = activeTag && activeTag.trim()
  const hasActiveSearch = searchQuery && searchQuery.trim()

  if (!hasActiveTag && !hasActiveSearch) {
    return null
  }

  // Build URL to remove tag filter while preserving other parameters
  const buildRemoveTagLink = () => {
    const params = new URLSearchParams(location.search)
    params.delete('tag')

    const queryString = params.toString()
    const basePath = location.pathname
    return `${basePath}${queryString ? `?${queryString}` : ''}`
  }

  // Build URL to remove search filter while preserving other parameters
  const buildClearSearchLink = () => {
    const params = new URLSearchParams(location.search)
    params.delete('search')

    const queryString = params.toString()
    const basePath = location.pathname
    return `${basePath}${queryString ? `?${queryString}` : ''}`
  }

  // Format result count text
  const getResultText = () => {
    if (resultCount === 0) {
      return 'No pins found'
    }
    return `${resultCount} ${resultCount === 1 ? 'pin' : 'pins'} found`
  }

  return (
    <div className={`${className}`}>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-foreground">FILTERS</label>
        <div className="border-4 border-foreground bg-input p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {hasActiveTag && (
                <div className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
                  <Tag className="h-3 w-3" />
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
              )}

              {hasActiveSearch && (
                <div className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
                  <Search className="h-3 w-3" />
                  <span>&quot;{searchQuery}&quot;</span>
                  <button
                    type="button"
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-foreground"
                    aria-label="Clear search"
                  >
                    <Link to={buildClearSearchLink()}>
                      <X className="h-3 w-3" />
                    </Link>
                  </button>
                </div>
              )}

              <span className="text-xs text-muted-foreground ml-2">
                {getResultText()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
