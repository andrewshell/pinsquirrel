# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-06-pin-editing/spec.md

> Created: 2025-08-06
> Version: 1.0.0

## Endpoints

### GET /pins/:id/edit

**Purpose:** Serve the pin edit page with pre-populated form data
**Parameters:** 
- `id` (URL parameter): Pin ID to edit
**Response:** HTML page with edit form
**Errors:** 
- 404 if pin not found or user doesn't own pin
- 401 if user not authenticated

**Route Loader Logic:**
- Authenticate user via `requireUser(request)`
- Call `pinService.getPin(userId, pinId)` to fetch pin data
- Return pin data to populate form
- Handle `PinNotFoundError` and `UnauthorizedPinAccessError` with appropriate redirects

### POST /pins/:id/edit

**Purpose:** Process pin edit form submission
**Parameters:** 
- `id` (URL parameter): Pin ID to edit
- Form data: `url`, `title`, `description` (all validated via existing schemas)
**Response:** Redirect to `/pins` with success flash message
**Errors:** 
- 400 for validation errors with error details
- 404 if pin not found or user doesn't own pin
- 409 if URL already exists for another pin
- 401 if user not authenticated

**Route Action Logic:**
- Authenticate user via `requireUser(request)`
- Parse and validate form data using existing `updatePinDataSchema`
- Call `pinService.updatePin(userId, pinId, formData)`
- Set success flash message and redirect to `/pins`
- Handle validation errors and service errors with appropriate error messages

## Service Methods Used

### pinService.getPin(userId, pinId)

**Purpose:** Fetch pin data for form pre-population
**Input:** User ID and Pin ID
**Output:** Pin entity with all fields and associated tags
**Error Handling:** 
- `PinNotFoundError` → 404 response
- `UnauthorizedPinAccessError` → 404 response (don't reveal existence)

### pinService.updatePin(userId, pinId, data)

**Purpose:** Update existing pin with new data
**Input:** User ID, Pin ID, and partial pin data (url, title, description)
**Output:** Updated pin entity
**Validation:** Uses existing `updatePinDataSchema` validation
**Error Handling:**
- `PinNotFoundError` → 404 response
- `UnauthorizedPinAccessError` → 404 response
- `DuplicatePinError` → 409 response with error message
- Validation errors → 400 response with field-specific errors

## Form Data Structure

```typescript
interface EditFormData {
  url: string           // Required, must be valid URL
  title: string         // Required, 1-200 characters
  description?: string  // Optional, max 1000 characters
}
```

**Note:** Tag editing is explicitly out of scope for this spec. The `tagNames` field will not be included in the edit form to preserve existing tag associations.