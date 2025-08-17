# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-17-tag-management-ui/spec.md

> Created: 2025-08-17
> Version: 1.0.0

## Test Coverage

### Unit Tests

**TagInput Component**
- Renders with empty state correctly
- Displays provided tags as removable chips
- Handles tag addition via Enter key and comma separation
- Validates tag names using existing tagNameSchema
- Shows validation errors for invalid tag names
- Calls onTagsChange callback with updated tag list
- Handles autocomplete dropdown interactions
- Supports keyboard navigation (Tab, Arrow keys, Escape)
- Respects disabled state and maxTags limit

**Form Validation Updates**
- validatePinCreation accepts and validates tagNames field
- Returns appropriate error messages for invalid tag names
- Handles empty tags array and undefined tagNames
- Integrates with existing field validation patterns

**API Route Handler**
- GET /api/tags returns user's tags in correct format
- Handles authentication requirements properly
- Returns empty array for users with no tags
- Filters tags by authenticated user only

### Integration Tests

**Pin Creation with Tags**
- Form submission includes tagNames in request payload
- Backend creates pin with associated tags correctly
- Existing tags are reused, new tags are created
- Tag association persists in database
- Form resets after successful tag-enabled pin creation

**Pin Editing with Tags**
- Form loads with existing pin tags pre-populated
- Tag modifications are saved correctly on form submission
- Removing all tags updates pin without tags
- Adding new tags creates tag associations properly

**Tag Autocomplete Flow**
- Component fetches user tags on mount
- Autocomplete dropdown shows relevant suggestions
- Selecting suggestion adds tag to input
- API calls are debounced during typing

### Mocking Requirements

- **TagRepository**: Mock findByUserId for consistent test data
- **API Responses**: Mock fetch calls for tag autocomplete testing  
- **User Authentication**: Mock session/user context for authenticated requests
- **Form Submission**: Mock form actions for testing tag handling without full backend