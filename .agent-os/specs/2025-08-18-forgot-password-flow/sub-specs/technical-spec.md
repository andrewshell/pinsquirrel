# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-18-forgot-password-flow/spec.md

> Created: 2025-08-18
> Version: 1.0.0

## Technical Requirements

- Secure token generation with 32+ bytes of entropy using crypto.randomBytes
- Token expiration set to 15 minutes for security
- Email service abstraction following repository pattern in core package
- Mailgun integration in separate package implementing email service interface
- Password reset tokens stored with bcrypt hashing in dedicated database table
- Rate limiting on password reset requests (max 3 per hour per email)
- One-time use tokens that are invalidated after successful password reset

## Approach Options

**Option A:** Store tokens in Redis with TTL (Not Selected)
- Pros: Automatic expiration, fast lookups, no cleanup needed
- Cons: Adds Redis dependency, tokens lost on Redis restart

**Option B:** Database table with scheduled cleanup (Selected)
- Pros: Consistent with existing architecture, reliable persistence, simple deployment
- Cons: Requires periodic cleanup of expired tokens

**Rationale:** Option B selected to maintain consistency with existing PostgreSQL-only architecture and avoid introducing new infrastructure dependencies.

## External Dependencies

- **mailgun.js** - Official Mailgun SDK for Node.js
- **Justification:** Official SDK provides reliable API integration with proper error handling and TypeScript support

## Clean Architecture Implementation

### Core Package (libs/core)
- `EmailService` interface for email abstraction
- `PasswordResetRepository` interface for token management
- `PasswordResetToken` entity and value objects
- Extended `AuthenticationService` with reset methods
- Domain error classes for password reset scenarios

### Mailgun Package (libs/mailgun)
- `MailgunEmailService` implementing `EmailService` interface
- Email template rendering and Mailgun API communication
- Error handling and retry logic for email delivery

### Database Package (libs/database)
- `password_reset_tokens` table schema with Drizzle ORM
- `DrizzlePasswordResetRepository` implementing repository interface
- Database migration for new table structure

### Web Package (apps/web)
- Password reset request route and form component
- Password reset confirmation route and form component
- Service configuration in dependency injection container