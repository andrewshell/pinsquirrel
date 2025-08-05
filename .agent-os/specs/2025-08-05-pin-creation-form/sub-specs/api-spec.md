# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-05-pin-creation-form/spec.md

> Created: 2025-08-05
> Version: 1.0.0

## Endpoints

### POST /api/pins

**Purpose:** Create a new pin for the authenticated user
**Authentication:** Required (user session)
**Parameters:** 
- Body (JSON):
  ```typescript
  {
    url: string;        // Required, valid URL format
    title: string;      // Required, 1-255 characters
    description?: string; // Optional, max 1000 characters
  }
  ```

**Response:**
- Success (201):
  ```typescript
  {
    id: string;
    url: string;
    title: string;
    description: string | null;
    userId: string;
    createdAt: string;
    updatedAt: string;
  }
  ```

**Errors:**
- 400: Invalid request body or validation errors
- 401: Not authenticated
- 409: Duplicate URL for user (if enforced)
- 500: Server error

### GET /api/metadata?url={url}

**Purpose:** Fetch metadata (title) from a given URL for auto-population
**Authentication:** Required (user session)
**Parameters:**
- Query: `url` (string) - URL to fetch metadata from

**Response:**
- Success (200):
  ```typescript
  {
    title?: string;     // Extracted page title if available
    description?: string; // Meta description if available (future use)
  }
  ```

**Errors:**
- 400: Invalid or missing URL parameter
- 401: Not authenticated  
- 404: Unable to fetch or parse URL content
- 500: Server error

## Controllers

### PinsController

**createPin Action:**
- Validate request body against pin creation schema
- Extract userId from authenticated session
- Check for duplicate URLs (if business rule applied)
- Call pin repository to create new pin
- Return created pin data or validation errors

### MetadataController

**fetchMetadata Action:**
- Validate URL parameter format
- Fetch HTML content from provided URL with timeout
- Parse HTML to extract title from `<title>` tag
- Extract meta description for future use
- Return extracted metadata or empty object if extraction fails
- Handle network timeouts and invalid responses gracefully

## Integration Points

- **Authentication Middleware:** Both endpoints require authenticated user session
- **Pin Repository:** Create pin endpoint uses existing pin repository from @pinsquirrel/database
- **HTTP Client:** Metadata endpoint needs HTTP client for external URL fetching
- **HTML Parser:** Metadata endpoint needs HTML parsing capability (cheerio or similar)