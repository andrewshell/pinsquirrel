import { MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { cn } from '~/lib/utils'

export type TagFilterType = 'all' | 'toread'

interface TagFilterProps {
  currentFilter: TagFilterType
  username: string
  className?: string
}

export function TagFilter({
  currentFilter,
  username,
  className,
}: TagFilterProps) {
  const getFilterLabel = (filter: TagFilterType) => {
    switch (filter) {
      case 'all':
        return 'All'
      case 'toread':
        return 'To Read'
      default:
        return 'All'
    }
  }

  const buildFilterLink = (filter: TagFilterType) => {
    const basePath = `/${username}/tags`
    if (filter === 'all') {
      return basePath
    }
    return `${basePath}?filter=${filter}`
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
