import type { FC } from 'hono/jsx'

interface ViewSettingsProps {
  sortBy: 'created' | 'title'
  sortDirection: 'asc' | 'desc'
  viewSize: 'expanded' | 'compact'
  searchParams: string
}

// Build URL with updated parameter while preserving others
function buildSettingsUrl(
  currentParams: string,
  param: string,
  value: string
): string {
  const params = new URLSearchParams(currentParams)
  params.set(param, value)
  params.delete('page') // Reset to page 1 when changing settings
  return params.toString()
}

export const ViewSettings: FC<ViewSettingsProps> = ({
  sortBy,
  sortDirection,
  viewSize,
  searchParams,
}) => {
  return (
    <div class="flex flex-wrap items-center gap-4 mb-4 text-sm">
      {/* Sort By */}
      <div class="flex items-center gap-2">
        <label class="text-muted-foreground">Sort:</label>
        <select
          class="px-2 py-1 border-2 border-foreground bg-background text-foreground neobrutalism-shadow-sm
                 focus:outline-none focus:ring-2 focus:ring-primary"
          hx-get="/pins/partial"
          hx-target="#pin-list"
          hx-swap="innerHTML"
          hx-push-url="true"
          hx-include="[name='tag'], [name='search'], [name='unread'], [name='direction'], [name='size']"
          name="sort"
        >
          <option value="created" selected={sortBy === 'created'}>
            Date Created
          </option>
          <option value="title" selected={sortBy === 'title'}>
            Title
          </option>
        </select>
      </div>

      {/* Sort Direction */}
      <div class="flex items-center gap-2">
        <label class="text-muted-foreground">Order:</label>
        <select
          class="px-2 py-1 border-2 border-foreground bg-background text-foreground neobrutalism-shadow-sm
                 focus:outline-none focus:ring-2 focus:ring-primary"
          hx-get="/pins/partial"
          hx-target="#pin-list"
          hx-swap="innerHTML"
          hx-push-url="true"
          hx-include="[name='tag'], [name='search'], [name='unread'], [name='sort'], [name='size']"
          name="direction"
        >
          <option value="desc" selected={sortDirection === 'desc'}>
            Newest First
          </option>
          <option value="asc" selected={sortDirection === 'asc'}>
            Oldest First
          </option>
        </select>
      </div>

      {/* View Size */}
      <div class="flex items-center gap-2">
        <label class="text-muted-foreground">View:</label>
        <select
          class="px-2 py-1 border-2 border-foreground bg-background text-foreground neobrutalism-shadow-sm
                 focus:outline-none focus:ring-2 focus:ring-primary"
          hx-get="/pins/partial"
          hx-target="#pin-list"
          hx-swap="innerHTML"
          hx-push-url="true"
          hx-include="[name='tag'], [name='search'], [name='unread'], [name='sort'], [name='direction']"
          name="size"
        >
          <option value="expanded" selected={viewSize === 'expanded'}>
            Expanded
          </option>
          <option value="compact" selected={viewSize === 'compact'}>
            Compact
          </option>
        </select>
      </div>

      {/* Hidden inputs to preserve filter values */}
      <input type="hidden" name="tag" id="view-settings-tag" />
      <input type="hidden" name="search" id="view-settings-search" />
      <input type="hidden" name="unread" id="view-settings-unread" />

      {/* Script to populate hidden inputs from URL */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
          (function() {
            var params = new URLSearchParams(window.location.search);
            var tagInput = document.getElementById('view-settings-tag');
            var searchInput = document.getElementById('view-settings-search');
            var unreadInput = document.getElementById('view-settings-unread');
            if (tagInput && params.get('tag')) tagInput.value = params.get('tag');
            if (searchInput && params.get('search')) searchInput.value = params.get('search');
            if (unreadInput && params.get('unread')) unreadInput.value = params.get('unread');
          })();
        `,
        }}
      />
    </div>
  )
}
