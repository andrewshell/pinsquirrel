# Technical Stack

> Last Updated: 2025-07-24
> Version: 1.0.0

## Core Technologies

### Application Framework
- **Framework:** React Router 7 (Framework mode)
- **Version:** 7.0+
- **Language:** TypeScript

### Database
- **Primary:** PostgreSQL
- **Version:** 16+
- **ORM:** Drizzle ORM

## Frontend Stack

### JavaScript Framework
- **Framework:** React
- **Version:** 19
- **Build Tool:** Vite

### Import Strategy
- **Strategy:** Node.js modules
- **Package Manager:** pnpm
- **Node Version:** 22 LTS

### CSS Framework
- **Framework:** TailwindCSS
- **Version:** 4.0+
- **PostCSS:** Yes

### UI Components
- **Library:** shadcn/ui
- **Version:** Latest

## Assets & Media

### Fonts
- **Provider:** Native Browser Fonts

### Icons
- **Library:** Lucide
- **Implementation:** React components

## Infrastructure

### Application Hosting
- **Platform:** Docker
- **Service:** Self-hosted or DigitalOcean
- **Region:** To be determined based on user base

### Database Hosting
- **Provider:** Docker (development)
- **Service:** To be determined for production
- **Backups:** To be configured

### Asset Storage
- **Provider:** Filesystem

## Deployment

### CI/CD Pipeline
- **Platform:** GitHub Actions
- **Trigger:** Push to main branch
- **Tests:** On PR, after merge, and before deployment

### Environments
- **Production:** main branch
- **Local:** feature branches

## Code Repository
- **URL:** Local git repository (not yet published)