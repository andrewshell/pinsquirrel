import { MoreHorizontal } from 'lucide-react'
import { useSearchParams } from 'react-router'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = searchParams.get('filter')
  const currentFilter: FilterType = filterParam === 'toread' ? 'toread' : 'all'

  const handleFilterChange = (filter: FilterType) => {
    const newSearchParams = new URLSearchParams(searchParams)

    if (filter === 'all') {
      newSearchParams.delete('filter')
    } else {
      newSearchParams.set('filter', filter)
    }

    // Reset to first page when filter changes
    newSearchParams.delete('page')

    setSearchParams(newSearchParams)
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
          onClick={() => handleFilterChange('all')}
        >
          All
        </Button>
        <Button
          variant={currentFilter === 'toread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFilterChange('toread')}
        >
          To Read
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
            <DropdownMenuItem onClick={() => handleFilterChange('all')}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFilterChange('toread')}>
              To Read
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
