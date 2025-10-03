import { ChevronDown, ArrowUpDown, Maximize2 } from 'lucide-react'
import { useLocation, Link } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

interface ViewSettingsProps {
  sort: 'created' | 'title'
  direction: 'asc' | 'desc'
  size: 'expanded' | 'compact'
  className?: string
}

export function ViewSettings({
  sort,
  direction,
  size,
  className,
}: ViewSettingsProps) {
  const location = useLocation()

  // Build URL for view setting changes
  const buildViewSettingLink = (
    newSort?: 'created' | 'title',
    newDirection?: 'asc' | 'desc',
    newSize?: 'expanded' | 'compact'
  ) => {
    const params = new URLSearchParams(location.search)

    if (newSort !== undefined) {
      params.set('sort', newSort)
    }
    if (newDirection !== undefined) {
      params.set('direction', newDirection)
    }
    if (newSize !== undefined) {
      params.set('size', newSize)
    }

    const queryString = params.toString()
    const basePath = location.pathname
    return `${basePath}${queryString ? `?${queryString}` : ''}`
  }

  const getSortLabel = (sortValue: 'created' | 'title') => {
    switch (sortValue) {
      case 'created':
        return 'Created'
      case 'title':
        return 'Title'
      default:
        return 'Created'
    }
  }

  const getDirectionLabel = (directionValue: 'asc' | 'desc') => {
    switch (directionValue) {
      case 'asc':
        return 'Ascending'
      case 'desc':
        return 'Descending'
      default:
        return 'Descending'
    }
  }

  const getSizeLabel = (sizeValue: 'expanded' | 'compact') => {
    switch (sizeValue) {
      case 'expanded':
        return 'Expanded'
      case 'compact':
        return 'Compact'
      default:
        return 'Expanded'
    }
  }

  return (
    <div className={className}>
      <div className="border-4 border-t-0 border-foreground bg-input p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-1 focus:ring-foreground"
              >
                <ArrowUpDown className="h-3 w-3" />
                <span>Sort: {getSortLabel(sort)}</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link to={buildViewSettingLink('created', direction, size)}>
                  Created
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={buildViewSettingLink('title', direction, size)}>
                  Title
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Direction Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-1 focus:ring-foreground"
              >
                <ArrowUpDown className="h-3 w-3" />
                <span>{getDirectionLabel(direction)}</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link to={buildViewSettingLink(sort, 'asc', size)}>
                  Ascending
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={buildViewSettingLink(sort, 'desc', size)}>
                  Descending
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Size Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-1 focus:ring-foreground"
              >
                <Maximize2 className="h-3 w-3" />
                <span>{getSizeLabel(size)}</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link to={buildViewSettingLink(sort, direction, 'expanded')}>
                  Expanded
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={buildViewSettingLink(sort, direction, 'compact')}>
                  Compact
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
