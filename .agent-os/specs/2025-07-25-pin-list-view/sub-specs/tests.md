# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-07-25-pin-list-view/spec.md

> Created: 2025-07-25
> Version: 1.0.0

## Test Coverage

### Unit Tests

**PinCard Component**
- Renders pin title correctly
- Displays truncated description with ellipsis for long text
- Shows all associated tags as badges
- Displays URL with proper formatting
- Shows placeholder when no description provided
- Renders action buttons (edit/delete) appropriately

**Pagination Component**
- Displays current page and total pages
- Disables previous button on first page
- Disables next button on last page
- Generates correct page number links
- Handles page click events correctly
- Shows ellipsis for large page ranges

**EmptyState Component**
- Displays appropriate message when no pins exist
- Shows call-to-action button to create first pin
- Renders correct icon and styling

### Integration Tests

**Pin List Route Loader**
- Fetches paginated pins for authenticated user
- Handles page parameter from URL correctly
- Returns proper pagination metadata
- Throws error for unauthenticated requests
- Handles invalid page numbers gracefully
- Respects pageSize limits

**Pin List Page**
- Displays loading state while data fetches
- Shows pin list after successful load
- Updates URL when navigating pages
- Maintains scroll position on page change
- Shows empty state when no pins exist
- Handles loader errors with error boundary

### Component Tests

**PinList Component**
- Renders correct number of PinCard components
- Passes pin data to each card correctly
- Integrates pagination controls
- Updates when loader data changes
- Handles responsive grid layout

### Accessibility Tests

- Keyboard navigation through pagination controls
- Screen reader announcements for page changes
- Proper ARIA labels on interactive elements
- Focus management after page transitions
- Color contrast compliance

## Mocking Requirements

- **PinRepository:** Mock `findByUserId` and `countByUserId` methods for loader tests
- **Authentication:** Mock `requireUser` function to return test user
- **React Router:** Use `createMemoryRouter` for route testing
- **Loader Context:** Mock context object with repository instances