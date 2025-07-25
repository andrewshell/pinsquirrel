# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-07-25-pin-list-view/spec.md

> Created: 2025-07-25
> Status: Ready for Implementation

## Tasks

- [x] 1. Set up pin list route and basic components

  - [x] 1.1 Write tests for PinCard component rendering
  - [x] 1.2 Implement PinCard component with title, URL, description, and tags
  - [x] 1.3 Write tests for EmptyState component
  - [x] 1.4 Implement EmptyState component with message and CTA
  - [x] 1.5 Create /pins route file with basic structure
  - [x] 1.6 Verify all component tests pass

- [x] 2. Implement data loading with pagination

  - [x] 2.1 Write tests for loader function with pagination
  - [x] 2.2 Implement loader with PinRepository integration
  - [x] 2.3 Add countByUserId method to PinRepository if missing
  - [x] 2.4 Write tests for authentication in loader
  - [x] 2.5 Implement requireUser helper function
  - [x] 2.6 Verify all loader tests pass

- [x] 3. Build pin list display with loader integration

  - [x] 3.1 Write tests for PinList component
  - [x] 3.2 Implement PinList component using useLoaderData
  - [x] 3.3 Add responsive grid layout with Tailwind
  - [x] 3.4 Integrate loading states using useNavigation
  - [x] 3.5 Connect EmptyState for no pins scenario
  - [x] 3.6 Verify integration tests pass

- [ ] 4. Add pagination controls

  - [ ] 4.1 Write tests for Pagination component
  - [ ] 4.2 Implement Pagination component with shadcn/ui
  - [ ] 4.3 Add page navigation with React Router links
  - [ ] 4.4 Write tests for URL parameter handling
  - [ ] 4.5 Implement page boundary logic and disabled states
  - [ ] 4.6 Verify all pagination tests pass

- [ ] 5. Polish and accessibility

  - [ ] 5.1 Write accessibility tests for keyboard navigation
  - [ ] 5.2 Add ARIA labels and screen reader support
  - [ ] 5.3 Implement focus management on page changes
  - [ ] 5.4 Add loading skeletons for better UX
  - [ ] 5.5 Test responsive behavior on different screens
  - [ ] 5.6 Verify all tests pass including accessibility

- [ ] 6. Create seeding script for manual testing

  - [ ] 6.1 Write script to create sample pins for an existing user
  - [ ] 6.2 Generate diverse pin data (various URLs, titles, descriptions, tags)
  - [ ] 6.3 Create enough pins to test pagination (30+ pins)
  - [ ] 6.4 Include pins with different states (readLater true/false)
  - [ ] 6.5 Add variety in tag usage for realistic testing
  - [ ] 6.6 Verify seeding script works and data displays correctly
