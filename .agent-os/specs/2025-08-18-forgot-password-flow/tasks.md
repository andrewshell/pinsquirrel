# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-18-forgot-password-flow/spec.md

> Created: 2025-08-18
> Status: Ready for Implementation

## Tasks

- [x] 1. Database Schema and Repository Implementation
  - [x] 1.1 Write tests for PasswordResetRepository interface
  - [x] 1.2 Create password_reset_tokens table schema with Drizzle
  - [x] 1.3 Generate and run database migration
  - [x] 1.4 Implement DrizzlePasswordResetRepository
  - [x] 1.5 Verify all repository tests pass

- [x] 2. Core Domain Layer Implementation
  - [x] 2.1 Write tests for password reset entities and value objects
  - [x] 2.2 Create PasswordResetToken entity and related types
  - [x] 2.3 Add password reset error classes to auth-errors.ts
  - [x] 2.4 Create EmailService interface
  - [x] 2.5 Create PasswordResetRepository interface
  - [x] 2.6 Verify all core domain tests pass

- [x] 3. Mailgun Email Service Package
  - [x] 3.1 Write tests for MailgunEmailService
  - [x] 3.2 Create libs/mailgun package structure
  - [x] 3.3 Implement MailgunEmailService class
  - [x] 3.4 Create password reset email templates
  - [x] 3.5 Verify all email service tests pass

- [ ] 4. Authentication Service Extensions
  - [ ] 4.1 Write tests for password reset methods in AuthenticationService
  - [ ] 4.2 Add requestPasswordReset method to AuthenticationService
  - [ ] 4.3 Add resetPassword method to AuthenticationService
  - [ ] 4.4 Add validateResetToken method to AuthenticationService
  - [ ] 4.5 Verify all authentication service tests pass

- [ ] 5. Web Routes and UI Components
  - [ ] 5.1 Write tests for forgot password routes and components
  - [ ] 5.2 Create /forgot-password route with form component
  - [ ] 5.3 Create /reset-password/:token route with form component
  - [ ] 5.4 Configure email service in dependency injection container
  - [ ] 5.5 Add navigation links for forgot password functionality
  - [ ] 5.6 Verify all web layer tests pass