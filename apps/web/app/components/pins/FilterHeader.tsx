import { X, Search, Tag, ChevronDown, Filter } from 'lucide-react'
import { useLocation, Link } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export type ReadFilterType = 'all' | 'toread' | 'read'

interface FilterHeaderProps {
  activeTag?: string
  searchQuery?: string
  currentFilter?: ReadFilterType
  noTags?: boolean
  className?: string
}

export function FilterHeader({
  activeTag,
  searchQuery,
  currentFilter = 'all',
  noTags = false,
  className,
}: FilterHeaderProps) {
  const location = useLocation()

  // Check which filters are active
  const hasActiveTag = activeTag && activeTag.trim()
  const hasActiveSearch = searchQuery && searchQuery.trim()
  // Always show the filter header since we always want to show the read status filter
  const hasActiveFilters = true

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

  // Build URL to remove notags filter while preserving other parameters
  const buildRemoveNoTagsLink = () => {
    const params = new URLSearchParams(location.search)
    params.delete('notags')

    const queryString = params.toString()
    const basePath = location.pathname
    return `${basePath}${queryString ? `?${queryString}` : ''}`
  }

  // Build URL for read filter options
  const buildReadFilterLink = (filter: ReadFilterType) => {
    const params = new URLSearchParams(location.search)

    if (filter === 'toread') {
      params.set('unread', 'true')
    } else if (filter === 'read') {
      params.set('unread', 'false')
    } else {
      params.delete('unread')
    }

    const queryString = params.toString()
    const basePath = location.pathname
    return `${basePath}${queryString ? `?${queryString}` : ''}`
  }

  // Get label for read filter
  const getReadFilterLabel = (filter: ReadFilterType) => {
    switch (filter) {
      case 'all':
        return 'All Pins'
      case 'toread':
        return 'To Read'
      case 'read':
        return 'Read'
      default:
        return 'All Pins'
    }
  }


  // Don't render if no filters are active
  if (!hasActiveFilters) {
    return null
  }

  return (
    <div className={`${className}`}>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-foreground">FILTERS</label>
        <div className="border-4 border-foreground bg-input p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Read Status Filter - Always visible */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <Filter className="h-3 w-3" />
                    <span>{getReadFilterLabel(currentFilter)}</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem asChild>
                    <Link to={buildReadFilterLink('all')}>All Pins</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={buildReadFilterLink('toread')}>To Read</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={buildReadFilterLink('read')}>Read</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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

              {noTags && (
                <div className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
                  <Tag className="h-3 w-3" />
                  <span>Untagged</span>
                  <button
                    type="button"
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-foreground"
                    aria-label="Clear untagged filter"
                  >
                    <Link to={buildRemoveNoTagsLink()}>
                      <X className="h-3 w-3" />
                    </Link>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
