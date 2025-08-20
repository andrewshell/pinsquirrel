import { MoreHorizontal } from 'lucide-react'
import { useLocation, Link } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { cn } from '~/lib/utils'

export type FilterType = 'all' | 'toread'

interface PinFilterProps {
  className?: string
}

export function PinFilter({ className }: PinFilterProps) {
  const location = useLocation()

  // Parse URL search params to determine current filter
  const searchParams = new URLSearchParams(location.search)
  const currentFilter: FilterType =
    searchParams.get('unread') === 'true' ? 'toread' : 'all'

  // Extract the username from the current path to build filter links
  const pathSegments = location.pathname.split('/')
  const usernameIndex = pathSegments.findIndex(
    segment => segment !== '' && segment !== 'pins'
  )
  const username = pathSegments[usernameIndex] || ''

  // Preserve other query parameters when switching filters
  const buildFilterLink = (filter: FilterType) => {
    const params = new URLSearchParams(location.search)

    if (filter === 'toread') {
      params.set('unread', 'true')
    } else {
      params.delete('unread')
    }

    const queryString = params.toString()
    return `/${username}/pins${queryString ? `?${queryString}` : ''}`
  }

  const getFilterLabel = (filter: FilterType) => {
    switch (filter) {
      case 'all':
        return 'All'
      case 'toread':
        return 'To Read'
      default:
        return 'All'
    }
  }

  return (
    <div className={cn('flex gap-2', className)}>
      {/* Desktop: Show both buttons side by side */}
      <div className="hidden sm:flex gap-2">
        <Button
          variant={currentFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          asChild
        >
          <Link to={buildFilterLink('all')}>All</Link>
        </Button>
        <Button
          variant={currentFilter === 'toread' ? 'default' : 'outline'}
          size="sm"
          asChild
        >
          <Link to={buildFilterLink('toread')}>To Read</Link>
        </Button>
      </div>

      {/* Mobile: Show current filter + dropdown menu */}
      <div className="flex sm:hidden gap-2">
        <Button size="sm">{getFilterLabel(currentFilter)}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={buildFilterLink('all')}>All</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={buildFilterLink('toread')}>To Read</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
