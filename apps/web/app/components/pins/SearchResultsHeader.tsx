import { X } from 'lucide-react'
import { Link, useLocation } from 'react-router'

interface SearchResultsHeaderProps {
  searchQuery: string
  resultCount: number
  className?: string
}

export function SearchResultsHeader({
  searchQuery,
  resultCount,
  className = '',
}: SearchResultsHeaderProps) {
  const location = useLocation()

  // Don't render if no search query
  if (!searchQuery.trim()) {
    return null
  }

  // Build URL to remove search filter while preserving other parameters
  const buildClearSearchLink = () => {
    const params = new URLSearchParams(location.search)
    params.delete('search')

    const queryString = params.toString()
    const basePath = location.pathname
    return `${basePath}${queryString ? `?${queryString}` : ''}`
  }

  return (
    <div className={`${className}`}>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-foreground">SEARCH</label>
        <div className="border-4 border-foreground bg-input p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
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
              <span className="text-xs text-muted-foreground ml-2">
                {resultCount === 0
                  ? 'No pins found'
                  : `${resultCount} ${resultCount === 1 ? 'pin' : 'pins'} found`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
