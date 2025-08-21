# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-21-basic-search/spec.md

> Created: 2025-08-21
> Version: 1.0.0

## Endpoints

### GET /:username/pins

**Purpose:** Modified to support search functionality alongside existing pagination

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `search` (optional): Search query string to filter pins by URL, title and description

**Response:** 
```json
{
  "pins": [
    {
      "id": "string",
      "title": "string",
      "url": "string",
      "description": "string",
      "readLater": "boolean",
      "createdAt": "string",
      "tags": ["string"]
    }
  ],
  "totalPages": "number",
  "currentPage": "number",
  "totalPins": "number"
}
```

**Errors:**
- 400: Invalid query parameters
- 401: Unauthorized
- 500: Server error

## Loader Modifications

### pins.$username.pins._index Route Loader

The existing loader in the pins index route will be modified to:

1. Extract the `search` query parameter from the request URL
2. Pass the search query to the repository method
3. Return filtered results when search is present
4. Maintain existing pagination logic

**Implementation:**
```typescript
export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page') || '1')
  const search = url.searchParams.get('search') || undefined
  
  // Pass search parameter to repository
  const result = await pinRepository.getUserPins(userId, page, 20, search)
  
  return json({
    ...result,
    search // Include search in response for UI state
  })
}
```

## Repository Interface

### PinRepository.searchPins Method

**Method Signature:**
```typescript
searchPins(
  userId: string,
  query: string,
  page: number,
  pageSize: number
): Promise<{
  pins: Pin[]
  totalPages: number
  currentPage: number
  totalPins: number
}>
```

**Purpose:** Search pins by URL, title and description with pagination support

**Parameters:**
- `userId`: The ID of the user whose pins to search
- `query`: The search term to match against URLs, titles and descriptions
- `page`: Page number for pagination
- `pageSize`: Number of results per page

**Returns:** Paginated search results matching the standard pins response format