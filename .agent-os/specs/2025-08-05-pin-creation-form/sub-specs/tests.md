# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-05-pin-creation-form/spec.md

> Created: 2025-08-05
> Version: 1.0.0

## Test Coverage

### Unit Tests

**PinCreationForm Component**
- Renders all form fields (URL, title, description)
- Shows validation errors for invalid URL format
- Shows validation errors for empty required fields  
- Calls onSubmit with correct data when form is valid
- Disables submit button during loading state
- Displays success message after successful submission
- Displays error message when submission fails
- Auto-populates title when URL metadata is fetched
- Allows manual override of auto-populated title
- Handles metadata fetching errors gracefully

**Pin Creation Schema (Zod)**
- Validates required URL field with proper format
- Validates required title field with length constraints
- Accepts optional description field
- Rejects malformed URLs
- Rejects empty or excessively long fields

**PinsController**
- Creates pin with valid data and authenticated user
- Returns 400 for invalid request body
- Returns 401 for unauthenticated requests
- Associates created pin with current user
- Handles database errors gracefully

**MetadataController**
- Fetches and parses title from valid HTML pages
- Returns empty object for pages without titles
- Handles network timeouts appropriately
- Returns 400 for invalid URL parameters
- Returns 401 for unauthenticated requests

### Integration Tests

**Pin Creation Workflow**
- User can navigate to pin creation form
- Form submits successfully with valid data
- User is redirected to pin list after successful creation
- Created pin appears in user's pin list
- Form preserves data during validation errors
- Auto-title fetching works with real URLs

**API Integration**
- POST /api/pins creates pin in database
- GET /api/metadata fetches real page titles
- Authentication middleware protects both endpoints
- Error responses include appropriate status codes and messages

### Feature Tests

**End-to-End Pin Creation**
- User logs in and navigates to create pin form
- User enters URL and sees title auto-populate
- User adds description and submits form
- User sees success confirmation and is redirected
- Created pin is visible in the pin list

**Error Handling Scenarios**
- User submits form with invalid URL and sees error
- User submits form without title and sees validation error
- User encounters network error during submission and sees retry option
- Auto-title fetching fails but form remains functional

## Mocking Requirements

- **HTTP Client:** Mock external URL fetching for metadata tests
- **Pin Repository:** Mock database operations for controller unit tests
- **Authentication:** Mock user session for protected endpoint tests
- **React Router:** Mock navigation functions for redirect testing
- **Timers:** Mock debounce timers for auto-title fetching tests