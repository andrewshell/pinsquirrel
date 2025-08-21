import { Search, X } from 'lucide-react'

interface SearchIconProps {
  onClick: () => void
  isSearchVisible?: boolean
}

export function SearchIcon({
  onClick,
  isSearchVisible = false,
}: SearchIconProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={isSearchVisible ? 'Close search' : 'Search pins'}
      className="p-2 text-foreground hover:bg-accent rounded-md transition-colors"
    >
      {isSearchVisible ? (
        <X className="h-5 w-5" />
      ) : (
        <Search className="h-5 w-5" />
      )}
    </button>
  )
}
