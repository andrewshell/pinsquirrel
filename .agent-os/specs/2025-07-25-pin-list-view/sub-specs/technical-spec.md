# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-07-25-pin-list-view/spec.md

> Created: 2025-07-25
> Version: 1.0.0

## Technical Requirements

- Display paginated list of pins for authenticated users
- Load pin data using React Router 7's loader functions
- Implement responsive design that works on mobile and desktop
- Handle loading states during data fetching
- Display empty state when no pins exist
- Use shadcn/ui components for consistent UI
- Implement proper error boundaries for graceful error handling
- Support keyboard navigation for accessibility

## Approach Options

**Option A: Client-side pagination with all data loaded**
- Pros: Fast page transitions, simpler implementation
- Cons: Poor performance with large datasets, high memory usage

**Option B: Server-side pagination with React Router loaders** (Selected)
- Pros: Scalable to large datasets, lower memory footprint, SEO-friendly
- Cons: Requires server round-trips for page changes

**Rationale:** Server-side pagination is essential for handling users with hundreds or thousands of pins. React Router 7's loader pattern provides excellent DX with type safety and built-in loading states.

## Implementation Details

### Route Structure
- Create new route at `/pins` that displays the pin list
- Use React Router 7's loader to fetch paginated data
- Pass page number as URL search parameter (e.g., `/pins?page=2`)

### Data Loading Pattern
```typescript
// Using React Router 7's loader with direct repository access
export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page')) || 1
  const pageSize = 25
  
  // Get authenticated user from context
  const user = await requireUser(request)
  
  // Direct repository access on the server
  const pinRepository = context.pinRepository
  const pins = await pinRepository.findByUserId(user.id, {
    limit: pageSize,
    offset: (page - 1) * pageSize
  })
  
  const totalCount = await pinRepository.countByUserId(user.id)
  const totalPages = Math.ceil(totalCount / pageSize)
  
  return { pins, totalPages, currentPage: page, totalCount }
}
```

### Component Structure
- `PinList` - Main container component that uses `useLoaderData()`
- `PinCard` - Individual pin display component
- `Pagination` - Reusable pagination controls using shadcn/ui
- `EmptyState` - Component shown when no pins exist
- `LoadingState` - Skeleton loader during data fetching

### State Management
- Use React Router's built-in loading states via `useNavigation()`
- URL parameters for pagination state (maintains state on refresh)
- No external state management needed for this feature

## UI/UX Specifications

### Pin Card Design
- Display pin title prominently
- Show URL with favicon (if available)
- Truncate description to 2-3 lines with ellipsis
- Display tags as small badges
- Include action buttons (edit/delete) on hover or always visible on mobile

### Pagination Controls
- Show current page and total pages
- Previous/Next buttons
- Direct page number inputs for large collections
- Display 5-7 page numbers with ellipsis for long lists
- Disable controls appropriately at boundaries

### Responsive Design
- Desktop: 2-3 column grid layout
- Tablet: 2 column grid
- Mobile: Single column list
- Touch-friendly tap targets (min 44px)

## External Dependencies

None required for this implementation. All functionality can be achieved with:
- React Router 7 (already in tech stack)
- shadcn/ui components (already in tech stack)
- Tailwind CSS (already in tech stack)