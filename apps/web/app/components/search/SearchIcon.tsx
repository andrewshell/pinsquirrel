import { Search } from 'lucide-react'

interface SearchIconProps {
  onClick: () => void
}

export function SearchIcon({ onClick }: SearchIconProps) {
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
      aria-label="Search pins"
      className="p-2 text-foreground hover:bg-accent rounded-md transition-colors"
    >
      <Search className="h-5 w-5" />
    </button>
  )
}
