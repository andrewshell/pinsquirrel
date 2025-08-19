# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-19-bookmarklet-integration/spec.md

> Created: 2025-08-19
> Version: 1.0.0

## Technical Requirements

- JavaScript bookmarklet code that safely extracts page metadata without violating CSP policies
- URL parameter handling in the pin creation route to accept pre-filled data
- HTML-to-markdown conversion for selected text processing
- Profile page UI component to display bookmarklet with installation instructions
- Authentication verification before displaying pre-filled pin creation form
- Cross-browser compatibility for bookmarklet functionality (Chrome, Firefox, Safari, Edge)

## Approach Options

**Option A: Simple URL Parameter Approach**
- Pros: Simple implementation, works with existing pin creation form, no new API endpoints needed
- Cons: URL length limitations, visible parameters in browser history

**Option B: Temporary Data Storage with API** 
- Pros: No URL length limits, cleaner URLs, more secure data handling
- Cons: Requires new API endpoint, temporary storage mechanism, more complex implementation

**Rationale:** Option A (Simple URL Parameter Approach) is selected because it leverages existing infrastructure, provides immediate functionality, and URL length limitations are unlikely to be reached with typical page metadata. The implementation is straightforward and aligns with the project's preference for simple solutions.

## Bookmarklet JavaScript Implementation

The bookmarklet will use a compressed JavaScript function that:
1. Extracts `document.title` for the page title
2. Gets current `window.location.href` for the URL
3. Attempts to get meta description from `document.querySelector('meta[name="description"]')`
4. Checks for selected text using `window.getSelection().toString()`
5. Converts HTML in selected text to markdown using basic text processing
6. URL-encodes all parameters and constructs target URL
7. Opens new window/tab with constructed URL

## External Dependencies

No new external dependencies required. Implementation will use:
- Vanilla JavaScript for bookmarklet code
- Existing React Router 7 routing system for parameter handling
- Built-in browser APIs (`window.getSelection`, `document.querySelector`)
- Native URL encoding functions