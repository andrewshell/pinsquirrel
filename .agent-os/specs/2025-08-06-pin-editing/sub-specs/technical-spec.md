# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-06-pin-editing/spec.md

> Created: 2025-08-06
> Version: 1.0.0

## Technical Requirements

- **React Router 7 Edit Route**: Create `/pins/:id/edit` route with loader and action functions
- **Form Pre-population**: Load existing pin data in route loader and populate form fields
- **Validation Integration**: Use existing `updatePinDataSchema` from `@pinsquirrel/core` for validation
- **Error Handling**: Implement proper error boundaries and user feedback for validation and network errors
- **Accessibility**: Form must be keyboard navigable with proper ARIA labels and error associations
- **Optimistic Updates**: Provide immediate user feedback during form submission
- **Tag Preservation**: Ensure existing tag associations are maintained during update operations
- **Type Safety**: Full TypeScript coverage with proper type inference from existing schemas

## Approach Options

**Option A:** Create completely new edit form component
- Pros: Clean separation, no risk of breaking existing creation form
- Cons: Code duplication, maintenance of two similar forms

**Option B:** Extend existing PinCreationForm to handle edit mode (Selected)
- Pros: Code reuse, consistent UI/UX, single component to maintain
- Cons: Component becomes more complex, need to handle both create/edit modes

**Option C:** Create shared form base with create/edit variations
- Pros: Good separation while sharing common logic
- Cons: Over-engineering for current needs, adds complexity

**Rationale:** Option B was selected because the edit form shares 90% of the same fields and validation logic as the creation form. By adding an edit mode to the existing component, we maintain consistency and avoid code duplication while keeping the solution simple and maintainable.

## External Dependencies

No new external dependencies are required. The implementation will use:
- **Existing validation schemas** from `@pinsquirrel/core`
- **Existing PinService updatePin method** already implemented
- **React Hook Form** already in use for form handling
- **shadcn/ui components** already integrated

## Implementation Details

### Route Structure
- **Route**: `/pins/:id/edit`
- **Loader**: Fetch existing pin data using `pinService.getPin()`
- **Action**: Handle form submission using `pinService.updatePin()`
- **Navigation**: Redirect to `/pins` on success with flash message

### Component Updates
- **PinCreationForm**: Add optional `editMode` and `initialData` props
- **Form Behavior**: Pre-populate fields when in edit mode
- **Submit Logic**: Use different submission handlers for create vs edit
- **Button Text**: Change from "Create Pin" to "Update Pin" in edit mode

### Data Flow
1. User clicks edit button on pin card/list item
2. Navigate to `/pins/:id/edit` route
3. Loader fetches pin data and passes to component
4. Form renders with pre-populated data
5. User makes changes and submits
6. Action validates and updates pin via service
7. Redirect to pins list with success message

### Error Handling
- **404 Errors**: Pin not found or user doesn't own pin
- **Validation Errors**: Display field-specific error messages
- **Network Errors**: Show retry mechanism with clear error message
- **Unauthorized**: Redirect to login if session expires