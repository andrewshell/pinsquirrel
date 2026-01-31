import type { FC } from 'hono/jsx'

interface ViewSettingsProps {
  sortBy: 'created' | 'title'
  sortDirection: 'asc' | 'desc'
  viewSize: 'expanded' | 'compact'
  searchParams: string
}

// Build URL with updated view setting
function buildViewSettingUrl(
  currentParams: string,
  setting: string,
  value: string
): string {
  const params = new URLSearchParams(currentParams)
  params.set(setting, value)
  params.delete('page')
  return params.toString()
}

// Get label for sort
function getSortLabel(sortValue: 'created' | 'title'): string {
  switch (sortValue) {
    case 'created':
      return 'Created'
    case 'title':
      return 'Title'
    default:
      return 'Created'
  }
}

// Get label for direction
function getDirectionLabel(directionValue: 'asc' | 'desc'): string {
  switch (directionValue) {
    case 'asc':
      return 'Ascending'
    case 'desc':
      return 'Descending'
    default:
      return 'Descending'
  }
}

// Get label for size
function getSizeLabel(sizeValue: 'expanded' | 'compact'): string {
  switch (sizeValue) {
    case 'expanded':
      return 'Expanded'
    case 'compact':
      return 'Compact'
    default:
      return 'Expanded'
  }
}

export const ViewSettings: FC<ViewSettingsProps> = ({
  sortBy,
  sortDirection,
  viewSize,
  searchParams,
}) => {
  return (
    <div class="flex items-center gap-3 mb-4">
      {/* Sort Dropdown */}
      <div class="relative" data-dropdown="container">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-muted-foreground px-2 py-1 text-xs hover:text-foreground transition-colors"
          data-dropdown="toggle"
        >
          <span>Sort: {getSortLabel(sortBy)}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="opacity-50"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <div
          class="hidden absolute left-0 mt-1 w-28 bg-background border-2 border-foreground shadow-lg z-50"
          data-dropdown="menu"
        >
          <a
            href={`/pins?${buildViewSettingUrl(searchParams, 'sort', 'created')}`}
            class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
          >
            Created
          </a>
          <a
            href={`/pins?${buildViewSettingUrl(searchParams, 'sort', 'title')}`}
            class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
          >
            Title
          </a>
        </div>
      </div>

      {/* Direction Dropdown */}
      <div class="relative" data-dropdown="container">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-muted-foreground px-2 py-1 text-xs hover:text-foreground transition-colors"
          data-dropdown="toggle"
        >
          <span>{getDirectionLabel(sortDirection)}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="opacity-50"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <div
          class="hidden absolute left-0 mt-1 w-28 bg-background border-2 border-foreground shadow-lg z-50"
          data-dropdown="menu"
        >
          <a
            href={`/pins?${buildViewSettingUrl(searchParams, 'direction', 'asc')}`}
            class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
          >
            Ascending
          </a>
          <a
            href={`/pins?${buildViewSettingUrl(searchParams, 'direction', 'desc')}`}
            class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
          >
            Descending
          </a>
        </div>
      </div>

      {/* Size Dropdown */}
      <div class="relative" data-dropdown="container">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-muted-foreground px-2 py-1 text-xs hover:text-foreground transition-colors"
          data-dropdown="toggle"
        >
          <span>{getSizeLabel(viewSize)}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="opacity-50"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <div
          class="hidden absolute left-0 mt-1 w-28 bg-background border-2 border-foreground shadow-lg z-50"
          data-dropdown="menu"
        >
          <a
            href={`/pins?${buildViewSettingUrl(searchParams, 'size', 'expanded')}`}
            class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
          >
            Expanded
          </a>
          <a
            href={`/pins?${buildViewSettingUrl(searchParams, 'size', 'compact')}`}
            class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
          >
            Compact
          </a>
        </div>
      </div>
    </div>
  )
}
