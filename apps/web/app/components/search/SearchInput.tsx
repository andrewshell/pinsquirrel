import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

interface SearchInputProps {
  isVisible: boolean
  onSearch: (query: string) => void
  onClose: () => void
  initialValue: string
}

export function SearchInput({
  isVisible,
  onSearch,
  onClose,
  initialValue,
}: SearchInputProps) {
  const [query, setQuery] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus when input becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isVisible])

  // Update local state when initialValue changes
  useEffect(() => {
    setQuery(initialValue)
  }, [initialValue])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch(query)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleSearch = () => {
    onSearch(query)
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search pins..."
        aria-label="Search pins"
        className="w-64 h-9"
      />
      <Button
        type="button"
        size="sm"
        onClick={handleSearch}
        aria-label="Search"
        className="h-9 px-3"
      >
        <Search className="h-4 w-4" />
      </Button>
    </div>
  )
}
