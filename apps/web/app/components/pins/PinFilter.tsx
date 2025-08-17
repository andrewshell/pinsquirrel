import { useSearchParams } from 'react-router'
import { Button } from '~/components/ui/button'
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

  return (
    <div className={cn('flex gap-2', className)}>
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
  )
}
