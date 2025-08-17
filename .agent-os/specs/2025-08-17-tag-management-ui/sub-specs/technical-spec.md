# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-17-tag-management-ui/spec.md

> Created: 2025-08-17
> Version: 1.0.0

## Technical Requirements

- **Tag Input Component**: Reusable React component with TypeScript that accepts tags and suggestions as props, provides local autocomplete filtering, and handles validation
- **Form Validation**: Extend existing `validatePinCreation` function to include `tagNames` field using existing `tagNamesSchema`
- **Route Data Loading**: Load user's existing tags in route `loader` functions using existing TagRepository
- **Server-First Approach**: Use React Router 7 data loading patterns for tag data, avoiding client-side API calls
- **UI/UX Requirements**: Follow shadcn/ui design patterns with proper accessibility (ARIA labels, keyboard navigation)
- **Performance**: Local filtering of suggestions for autocomplete, no debouncing needed

## Approach Options

**Option A: Server-Side Data Loading with Local Filtering** (Selected)
- Pros: Follows React Router 7 Framework patterns, server-first approach, no client-side API calls
- Cons: Tag suggestions loaded on route navigation, not dynamically updated

**Option B: Client-Side API Calls with Debouncing**
- Pros: Dynamic tag suggestions, real-time updates
- Cons: Against React Router 7 Framework philosophy, requires separate API endpoints

**Option C: Third-party Tag Input Library**
- Pros: Battle-tested component, accessibility built-in
- Cons: May not integrate well with React Router 7 data loading patterns

**Rationale:** Option A selected to follow React Router 7 Framework mode patterns. Load user tags in route loaders using existing repositories, pass as props to TagInput component, and filter locally for autocomplete functionality.

## External Dependencies

- **@radix-ui/react-popover** - For autocomplete dropdown positioning and accessibility
- **Justification:** Already used in shadcn/ui components, provides robust popover functionality with proper focus management and ARIA support

## Implementation Details

### TagInput Component Structure
```typescript
interface TagInputProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  suggestions: string[]  // Passed from route loader data
  placeholder?: string
  disabled?: boolean
  maxTags?: number
}
```

### Route Loader Integration
```typescript
// In pins.new.tsx and pins.$id.edit.tsx
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request)
  const userTags = await repositories.tag.findByUserId(user.id)
  return data({ 
    userTags: userTags.map(tag => tag.name),
    // ... other loader data
  })
}
```

### Form Integration
- Extend `PinCreationFormData` type to include `tags: string[]`
- Update form validation to use existing `tagNamesSchema`
- Pass tag suggestions from loader data to TagInput component
- Modify form submission to include `tagNames` field in existing action functions

### Local Autocomplete Filtering
- TagInput component filters `suggestions` prop based on user input
- No server-side API calls during autocomplete interaction
- Fast local filtering provides responsive user experience