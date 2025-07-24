# Product Roadmap

> Last Updated: 2025-07-24
> Version: 1.0.0
> Status: Planning

## Phase 0: Already Completed

The following features have been implemented:

- [x] User authentication system - Complete registration, login, and password management `L`
- [x] Database schema - Users, pins, tags with many-to-many relationships `M`
- [x] Pin repository - Full CRUD operations for pins with tag associations `L`
- [x] Tag repository - Complete tag management with usage tracking `M`
- [x] Core architecture - Clean architecture with dependency injection `M`
- [x] Privacy implementation - Zero PII storage with hashed emails `S`
- [x] Test coverage - Comprehensive unit tests for all repositories `M`
- [x] Monorepo setup - pnpm workspace with Turbo orchestration `S`
- [x] Development tooling - ESLint, Prettier, TypeScript configuration `S`

## Phase 1: Pin Management UI (1-2 weeks)

**Goal:** Create the user interface for managing pins
**Success Criteria:** Users can create, view, edit, and delete pins through the web interface

### Must-Have Features

- [ ] Pin list view - Display all user pins with pagination `M`
- [ ] Pin creation form - Add new pins with URL, title, description `S`
- [ ] Pin editing - Update existing pin information `S`
- [ ] Tag management UI - Add/remove tags from pins `M`
- [ ] Basic search - Search pins by title and description `M`

### Should-Have Features

- [ ] Pin deletion with confirmation - Safe deletion workflow `XS`
- [ ] Tag autocomplete - Suggest existing tags during input `S`
- [ ] Bulk operations - Select multiple pins for tagging `M`

### Dependencies

- React Router 7 routes setup
- shadcn/ui component integration
- API endpoints for pin operations

## Phase 2: Multi-Format Content Support (2-3 weeks)

**Goal:** Enable saving content in multiple formats beyond just URLs
**Success Criteria:** Users can save and view images, markdown content, and read-later articles

### Must-Have Features

- [ ] Image upload - Store and display image pins `L`
- [ ] Markdown editor - Create and edit markdown content `M`
- [ ] Content type switching - Toggle between link/image/markdown views `M`
- [ ] Read-later article capture - Save full article content `L`
- [ ] Format-specific views - Optimized display for each content type `M`

### Should-Have Features

- [ ] Image preview thumbnails - Generate and cache thumbnails `M`
- [ ] Markdown preview - Live preview while editing `S`
- [ ] Article reader mode - Clean, distraction-free reading view `M`

### Dependencies

- File storage configuration
- Image processing library
- Markdown parser/renderer
- Article extraction service

## Phase 3: Advanced Search and Organization (1-2 weeks)

**Goal:** Provide powerful search and filtering capabilities
**Success Criteria:** Users can quickly find any saved content through advanced search

### Must-Have Features

- [ ] Full-text search - Search across all content including markdown `L`
- [ ] Tag filtering - Filter pins by multiple tags `M`
- [ ] Date range filtering - Find pins by creation/update date `S`
- [ ] Search result highlighting - Show matched terms in results `S`

### Should-Have Features

- [ ] Saved searches - Store frequently used search queries `M`
- [ ] Search suggestions - Auto-suggest as user types `M`
- [ ] Export search results - Download filtered pin lists `S`

### Dependencies

- Search indexing strategy
- Database query optimization
- Frontend filter components

## Phase 4: RSS Aggregation and Automation (2-3 weeks)

**Goal:** Automatically populate pins from RSS feeds
**Success Criteria:** Users can subscribe to RSS feeds and automatically create pins from new items

### Must-Have Features

- [ ] RSS feed subscription - Add and manage RSS feed URLs `L`
- [ ] Feed parsing - Extract and convert RSS items to pins `L`
- [ ] Update scheduling - Periodic feed checking `M`
- [ ] Feed management UI - View and control subscribed feeds `M`
- [ ] Duplicate detection - Avoid creating duplicate pins `M`

### Should-Have Features

- [ ] Feed categorization - Auto-tag pins based on feed source `M`
- [ ] Feed preview - Preview items before subscribing `S`
- [ ] Update notifications - Alert users to new items `M`

### Dependencies

- RSS parsing library
- Background job processing
- Cron scheduling system

## Phase 5: Import/Export and API (2 weeks)

**Goal:** Enable data portability and third-party integrations
**Success Criteria:** Users can import/export their data and access via API

### Must-Have Features

- [ ] Browser bookmark import - Import from Chrome/Firefox/Safari/Pinboard `L`
- [ ] Data export - Export all pins in JSON/CSV formats `M`
- [ ] REST API - Basic CRUD operations via API `L`
- [ ] API authentication - Secure token-based access `M`

### Should-Have Features

- [ ] API rate limiting - Prevent abuse of API endpoints `S`
- [ ] Webhook support - Notify external services of changes `L`
- [ ] Backup automation - Scheduled automatic exports `M`

### Dependencies

- API documentation
- Rate limiting middleware
- Import format parsers
- Authentication token system