# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-19-bookmarklet-integration/spec.md

> Created: 2025-08-19
> Version: 1.0.0

## Test Coverage

### Unit Tests

**Bookmarklet Component**
- Renders bookmarklet link with correct href attribute
- Displays installation instructions clearly
- Handles bookmarklet JavaScript generation correctly
- Escapes special characters in generated JavaScript

**Pin Creation Form URL Parameter Handling**
- Pre-fills title field when title parameter provided
- Pre-fills URL field when url parameter provided  
- Pre-fills description field when description parameter provided
- Handles missing parameters gracefully without errors
- Properly URL-decodes parameters with special characters

### Integration Tests

**Profile Page Bookmarklet Display**
- Authenticated user sees bookmarklet section on profile page
- Bookmarklet link generates valid JavaScript code
- Installation instructions are visible and clear

**Pin Creation with Pre-filled Data**
- Opening pin creation URL with parameters pre-fills form correctly
- Form submission works normally with pre-filled data
- User can modify pre-filled data before saving
- Authentication is required to access pre-filled pin creation

### End-to-End Tests

**Complete Bookmarklet Workflow**
- User can drag bookmarklet from profile page to bookmarks bar (manual test)
- Clicking bookmarklet on external page opens PinSquirrel with correct data
- Selected text on source page appears as markdown in description field
- Pin saves successfully after using bookmarklet

### Mocking Requirements

**External Page Simulation:** Mock browser environment with document.title, meta tags, and selected text for testing bookmarklet JavaScript functionality