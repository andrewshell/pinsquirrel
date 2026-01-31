# PinSquirrel Stack Migration Plan

> **Goal**: Migrate from React Router 7 to Hono + HTMX + Vanilla JS
> **Approach**: Parallel development in monorepo, then swap
> **Created**: 2026-01-30

## Overview

Build a new `apps/hono` application alongside the existing `apps/web`, sharing all existing libs. Once feature-complete, swap and deprecate the React app.

```
pinsquirrel/
├── apps/
│   ├── web/          # Current React Router 7 (keep running during migration)
│   └── hono/         # NEW: Hono + HTMX + Vanilla JS
├── libs/
│   ├── services/     # SHARED: Business logic (no changes needed)
│   ├── database/     # SHARED: Drizzle repositories (no changes needed)
│   ├── domain/       # SHARED: Entities & interfaces (no changes needed)
│   ├── adapters/     # SHARED: HTML parser, HTTP client (no changes needed)
│   └── mailgun/      # SHARED: Email service (no changes needed)
```

## Stack Details

| Component     | Choice        | Version  | Purpose                                 |
| ------------- | ------------- | -------- | --------------------------------------- |
| Runtime       | Node.js       | 22 LTS   | Matches current setup                   |
| Framework     | Hono          | 4.x      | HTTP routing, middleware, JSX templates |
| Templates     | Hono JSX      | built-in | Server-rendered HTML                    |
| Interactivity | HTMX          | 2.x      | Partial page updates, form handling     |
| Complex UI    | Vanilla JS    | -        | Dropdowns, tag input autocomplete       |
| Sessions      | hono-sessions | latest   | Cookie-based auth sessions              |
| Styling       | Tailwind CSS  | 4.x      | Keep existing styles                    |
| Database      | Drizzle       | existing | No changes                              |
| Validation    | Zod           | existing | No changes                              |

## Phase 1: Project Setup ✅ COMPLETE

**Goal**: Scaffold `apps/hono` with basic routing and shared lib integration

### Tasks

- [x] 1.1 Create `apps/hono` directory structure

  ```
  apps/hono/
  ├── src/
  │   ├── index.ts           # Entry point
  │   ├── app.ts             # Hono app setup
  │   ├── routes/            # Route handlers
  │   ├── views/             # JSX templates
  │   │   ├── layouts/       # Base layouts
  │   │   └── components/    # Reusable partials
  │   ├── middleware/        # Auth, sessions, etc.
  │   └── static/            # CSS, JS assets
  ├── package.json
  ├── tsconfig.json
  └── vite.config.ts         # For Tailwind/asset building
  ```

- [x] 1.2 Initialize package.json

  ```json
  {
    "name": "@pinsquirrel/hono",
    "type": "module",
    "scripts": {
      "dev": "tsx watch src/index.ts",
      "build": "tsup src/index.ts --format esm",
      "start": "node dist/index.js"
    },
    "dependencies": {
      "hono": "^4.x",
      "@hono/node-server": "^1.x",
      "htmx.org": "^2.x",
      "@pinsquirrel/services": "workspace:*",
      "@pinsquirrel/database": "workspace:*",
      "@pinsquirrel/domain": "workspace:*"
    }
  }
  ```

- [x] 1.3 Configure TypeScript with JSX support

  ```json
  {
    "compilerOptions": {
      "jsx": "react-jsx",
      "jsxImportSource": "hono/jsx"
    }
  }
  ```

- [x] 1.4 Set up Tailwind CSS build pipeline
  - Reuse existing Tailwind config
  - Output to `static/styles.css`

- [x] 1.5 Create base layout template

  ```tsx
  // src/views/layouts/base.tsx
  export const BaseLayout = ({ children, title }) => (
    <html>
      <head>
        <title>{title} - PinSquirrel</title>
        <link rel="stylesheet" href="/static/styles.css" />
        <script src="/static/htmx.min.js" />
        <script src="/static/dropdown.js" defer />
        <script src="/static/tag-input-vanilla.js" defer />
      </head>
      <body class="bg-gray-50 dark:bg-gray-900">{children}</body>
    </html>
  )
  ```

- [x] 1.6 Create health check route to verify setup

  ```ts
  app.get('/health', c => c.json({ status: 'ok' }))
  ```

- [x] 1.7 Verify shared libs work
  - Import and call a service method
  - Confirm database connection

### Verification

- `pnpm dev --filter @pinsquirrel/hono` starts server
- `curl localhost:8100/health` returns `{"status":"ok"}`
- Can query database via shared libs

---

## Phase 2: Authentication System

**Goal**: Implement session-based auth matching current functionality

### Tasks

- [x] 2.1 Add sessions table to database schema

  ```ts
  // libs/database/src/schema/sessions.ts
  export const sessions = pgTable('sessions', {
    id: text('id').primaryKey(), // UUID or random string
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    data: jsonb('data'), // Additional session data if needed
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  })
  ```

- [x] 2.2 Set up session middleware

  ```ts
  // Database-backed sessions
  app.use(
    '*',
    sessionMiddleware({
      store: new DrizzleSessionStore(db),
      cookie: { httpOnly: true, secure: true, sameSite: 'lax' },
    })
  )
  ```

- [x] 2.3 Create auth middleware (completed as part of 2.2)

  ```ts
  // Redirect to /signin if not authenticated
  const requireAuth = async (c, next) => {
    const session = c.get('session')
    if (!session.userId) return c.redirect('/signin')
    await next()
  }
  ```

- [x] 2.4 Implement sign-in page
  - GET `/signin` - render form
  - POST `/signin` - validate, create session, redirect
  - Use existing `AuthenticationService.signIn()`

- [x] 2.5 Implement sign-up page
  - GET `/signup` - render form
  - POST `/signup` - validate, create user, redirect (via email verification)
  - Use existing `AuthenticationService.register()`

- [x] 2.6 Implement sign-out
  - POST `/logout` - destroy session (delete from DB), redirect
  - GET `/logout` - also supported for convenience

- [x] 2.7 Implement forgot password flow
  - GET/POST `/forgot-password`
  - GET/POST `/reset-password/:token`
  - Use existing `AuthenticationService` methods

- [x] 2.8 Port flash message system
  - Session-based flash messages for success/error
  - Display in layout template

### Verification

- Can register new account
- Can sign in/out
- Session persists across requests
- Flash messages display correctly

---

## Phase 3: Pin Management (Core CRUD)

**Goal**: Implement pin list, create, edit, delete with HTMX

### Tasks

- [x] 3.1 Create pin list page (`/pins`)

  ```tsx
  // Server renders full page initially
  // HTMX handles pagination, filtering
  <div id="pin-list" hx-get="/pins/partial" hx-trigger="load">
    Loading...
  </div>
  ```

- [x] 3.2 Implement pin list partial (`/pins/partial`)
  - Returns just the pin cards HTML
  - Accepts query params: `?tag=x&search=y&unread=true&page=1`
  - Used by HTMX for filtering/pagination

- [x] 3.3 Create PinCard component

  ```tsx
  const PinCard = ({ pin }) => (
    <article class="pin-card" id={`pin-${pin.id}`}>
      <h3>
        <a href={pin.url}>{pin.title}</a>
      </h3>
      <p>{pin.description}</p>
      <div class="tags">
        {pin.tags.map(t => (
          <Tag tag={t} />
        ))}
      </div>
      <button
        hx-post={`/pins/${pin.id}/toggle-read`}
        hx-swap="outerHTML"
        hx-target={`#pin-${pin.id}`}
      >
        {pin.readAt ? 'Mark Unread' : 'Mark Read'}
      </button>
    </article>
  )
  ```

- [x] 3.4 Implement mark as read toggle
  - POST `/pins/:id/toggle-read`
  - Returns updated PinCard HTML
  - HTMX swaps in place (instant feedback)

- [x] 3.5 Create pin form (`/pins/new`)
  - Standard HTML form
  - Server-side validation with Zod
  - Redirect on success with flash message

- [x] 3.6 Implement metadata fetch (server-side)
  - GET `/api/metadata?url=...`
  - Returns JSON to populate form
  - Or: HTMX partial that updates title/description fields

- [x] 3.7 Create edit form (`/pins/:id/edit`)
  - Pre-populated form
  - Same validation as create

- [x] 3.8 Create delete confirmation (`/pins/:id/delete`)
  - Simple confirmation page
  - Or: HTMX modal pattern

- [x] 3.9 Implement search

  ```html
  <input
    type="search"
    name="search"
    hx-get="/pins/partial"
    hx-trigger="keyup changed delay:300ms"
    hx-target="#pin-list"
  />
  ```

- [x] 3.10 Implement tag filtering
  - Click tag → HTMX GET with `?tag=x`
  - Multiple filter combinations

- [x] 3.11 Implement pagination
  ```html
  <a hx-get="/pins/partial?page=2" hx-target="#pin-list" hx-swap="innerHTML">
    Next Page
  </a>
  ```

### Verification

- Can list, create, edit, delete pins
- Search works with debounce
- Tag filtering works
- Mark as read updates instantly
- Pagination loads without full page reload

---

## Phase 4: Tag Input Component (Vanilla JS) ✅ COMPLETE

**Goal**: Build autocomplete tag input with vanilla JavaScript

### Tasks

- [x] 4.1 Create vanilla JS tag input component
  - Uses `data-tag-input` attributes for element selection
  - Server renders initial tags as pills
  - JavaScript handles dynamic interactions

- [x] 4.2 Implement vanilla JS component logic
  - `tag-input-vanilla.js` handles all tag input functionality
  - Autocomplete filtering, keyboard navigation, tag add/remove

- [x] 4.3 Load existing tags from server
  - Inline as JSON in page
  - Or: fetch on component init

- [x] 4.4 Handle accessibility
  - ARIA attributes for autocomplete
  - Keyboard navigation
  - Screen reader announcements

- [x] 4.5 Style to match existing UI
  - Port Tailwind classes from React component

### Verification

- Can type and add tags
- Autocomplete shows suggestions
- Keyboard navigation works (up/down/enter/escape/backspace)
- Accessible with screen reader
- Works on mobile

---

## Phase 5: Supporting Pages

**Goal**: Implement remaining pages and features

### Tasks

- [x] 5.1 Tags cloud page (`/tags`)
  - List all tags with usage counts
  - Click to filter pins

- [x] 5.2 Tag merge page (`/tags/merge`)
  - Form to merge duplicate tags

- [x] 5.3 Profile page (`/profile`)
  - View/edit user settings
  - Change password form

- [x] 5.4 View settings (sort/size)
  - Vanilla JS dropdowns for instant toggle
  - Persist in query string like in original react app (use same query keys)

- [x] 5.5 Filter header component
  - Show active filters
  - Clear filter buttons
  - All HTMX-powered

- [x] 5.6 Empty states
  - No pins yet
  - No search results
  - No tags

- [x] 5.7 Error pages
  - 404 Not Found
  - 500 Server Error

- [x] 5.8 Bookmarklet support
  - `/pins/new?url=...&title=...` pre-population

### Verification

- All pages render correctly
- Navigation works
- Bookmarklet works

---

## Phase 6: Polish and Parity Check

**Goal**: Ensure feature parity with React app

### Tasks

- [ ] 6.1 Compare feature checklist
      | Feature | React App | Hono App |
      |---------|-----------|----------|
      | Sign up | ✓ | ? |
      | Sign in | ✓ | ? |
      | ... | | |

- [ ] 6.2 Port all Tailwind styles
  - Verify responsive design
  - Dark mode support

- [ ] 6.3 Test on multiple browsers
  - Chrome, Firefox, Safari
  - Mobile browsers

- [ ] 6.4 Performance comparison
  - Page load times
  - Time to interactive
  - Bundle sizes

- [ ] 6.5 Add any missing validations
  - Server-side matches React app
  - Error messages consistent

- [ ] 6.6 Duplicate URL detection
  - Port existing functionality

### Verification

- Feature parity confirmed
- Performance equal or better
- No regressions

---

## Phase 7: Deployment and Cutover

**Goal**: Deploy Hono app and retire React app

### Tasks

- [ ] 7.1 Update Docker configuration
  - New Dockerfile for Hono app
  - Smaller image (no React/Node SSR overhead)
  - Create `migrate-and-start.sh` script (like `apps/web/migrate-and-start.sh`)
  - Ensure startup migration hook runs before app starts

- [ ] 7.2 Update CI/CD pipeline
  - Build Hono app
  - Run tests

- [ ] 7.3 Deploy to staging
  - Test with production data copy

- [ ] 7.4 Cutover plan
  - DNS/proxy switch
  - Rollback procedure

- [ ] 7.5 Execute cutover
  - Switch traffic to Hono app
  - Monitor for issues

- [ ] 7.6 Deprecate React app
  - Remove `apps/web` directory
  - Update documentation (including PRODUCTION_DEPLOYMENT.md)
  - Clean up unused dependencies

### Verification

- Production deployment successful
- No downtime
- All features working

---

## Parallel Development Strategy

Since this is a monorepo, both apps can run simultaneously:

```bash
# Terminal 1: Keep React app running (existing functionality)
pnpm dev --filter @pinsquirrel/web

# Terminal 2: Develop Hono app
pnpm dev --filter @pinsquirrel/hono
```

**Port allocation:**

- React app: `localhost:5173` (current)
- Hono app: `localhost:8100` (new)

**Database:** Both apps share the same database and libs, so:

- Changes made in React app appear in Hono app
- Can test both side-by-side
- No data migration needed

---

## Estimated Effort

| Phase         | Effort       | Can Parallelize |
| ------------- | ------------ | --------------- |
| 1. Setup      | S (1-2 days) | -               |
| 2. Auth       | M (2-3 days) | -               |
| 3. Pins CRUD  | L (4-5 days) | After Phase 2   |
| 4. Tag Input  | M (2-3 days) | After Phase 1   |
| 5. Supporting | M (2-3 days) | After Phase 3   |
| 6. Polish     | S (1-2 days) | After Phase 5   |
| 7. Deploy     | S (1 day)    | After Phase 6   |

**Total: ~2-3 weeks** (working incrementally)

Phases 3 and 4 can be worked on in parallel once auth is done.

---

## Decisions Made

1. **Session storage**: **Database sessions** - Store in PostgreSQL for server-side invalidation
2. **Asset pipeline**: Vite for Tailwind (matches existing setup)
3. **Testing strategy**: **Fresh tests** - Write new tests as we build; service/database tests in libs already exist
4. **Alpine vs vanilla JS**: Vanilla JS for dropdowns and tag input (Alpine had JSX compatibility issues)

---

## Files to Reference

Current implementations to port:

- `apps/web/app/components/TagInput.tsx` → Vanilla JS component
- `apps/web/app/components/PinCard.tsx` → JSX partial
- `apps/web/app/routes/pins.tsx` → Hono routes
- `apps/web/app/routes/signin.tsx` → Auth routes
- `libs/services/src/` → Reuse as-is

---

## Notes

- Keep the React app working until Hono app is feature-complete
- Shared libs mean zero business logic duplication
- HTMX eliminates most client-side state management
- Vanilla JS is used for dropdowns (`dropdown.js`) and tag autocomplete (`tag-input-vanilla.js`)
- No framework dependencies for client-side interactivity
