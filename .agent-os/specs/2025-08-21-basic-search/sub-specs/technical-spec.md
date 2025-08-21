# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-21-basic-search/spec.md

> Created: 2025-08-21
> Version: 1.0.0

## Technical Requirements

- Implement search icon button in the application header using Lucide React icons
- Create an expandable search input component that toggles visibility on icon click
- Implement search query parameter handling in React Router 7 routes
- Add search method to the Pin repository that performs case-insensitive partial text matching across URLs, titles, and descriptions
- Integrate search functionality with existing pagination system
- Maintain responsive design for search interface on mobile and desktop
- Ensure search state persists in URL for browser back/forward navigation
- Handle empty search results with appropriate messaging

## UI/UX Specifications

- Search icon should use the Lucide "Search" icon component
- Search input should expand/collapse with smooth animation
- Search input should auto-focus when revealed
- Pressing Escape should close the search input and clear the query
- Search should trigger on Enter key or search button click
- Search query should be reflected in the URL as a query parameter
- Empty state should show "No pins found for '[query]'" message
- Loading state should be shown during search execution

## Approach Options

**Option A:** Client-side filtering of all pins
- Pros: Fast response, no server round-trip, simple implementation
- Cons: Doesn't scale with large datasets, requires loading all pins

**Option B:** Server-side database search (Selected)
- Pros: Scales with data growth, works with pagination, more efficient
- Cons: Requires database query implementation, network latency

**Rationale:** Server-side search is selected because it aligns with the existing pagination system and will scale as users accumulate more pins. The application already uses server-side data fetching patterns.

## Implementation Details

### Frontend Components

1. **SearchIcon Component** - Icon button in header that toggles search input
2. **SearchInput Component** - Expandable input field with search button
3. **URL Parameter Handling** - Use React Router's useSearchParams hook

### Backend Implementation

1. **Repository Method** - Add `searchPins` method to PinRepository
2. **SQL Query** - Use ILIKE operator for case-insensitive partial matching
3. **API Endpoint** - Modify existing pins list endpoint to accept search parameter

### Database Query Strategy

```sql
SELECT * FROM pins 
WHERE user_id = ? 
  AND (url ILIKE '%' || ? || '%' 
       OR title ILIKE '%' || ? || '%' 
       OR description ILIKE '%' || ? || '%')
ORDER BY created_at DESC
LIMIT ? OFFSET ?
```

## External Dependencies

No new external dependencies are required. The implementation will use:
- Existing Lucide React icons (already in project)
- React Router 7's built-in hooks (already in project)
- PostgreSQL's ILIKE operator (native to database)