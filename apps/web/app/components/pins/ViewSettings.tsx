import { ChevronDown } from 'lucide-react'
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
      <div className="flex items-center gap-3">
        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-muted-foreground px-2 py-1 text-xs hover:text-foreground transition-colors focus:outline-none"
            >
              <span>Sort: {getSortLabel(sort)}</span>
              <ChevronDown className="h-3 w-3 ml-0.5 opacity-50" />
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
              className="inline-flex items-center gap-1 text-muted-foreground px-2 py-1 text-xs hover:text-foreground transition-colors focus:outline-none"
            >
              <span>{getDirectionLabel(direction)}</span>
              <ChevronDown className="h-3 w-3 ml-0.5 opacity-50" />
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
              className="inline-flex items-center gap-1 text-muted-foreground px-2 py-1 text-xs hover:text-foreground transition-colors focus:outline-none"
            >
              <span>{getSizeLabel(size)}</span>
              <ChevronDown className="h-3 w-3 ml-0.5 opacity-50" />
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
  )
}
