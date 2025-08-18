# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-18-forgot-password-flow/spec.md

> Created: 2025-08-18
> Version: 1.0.0

## Test Coverage

### Unit Tests

**PasswordResetToken Entity**
- Token creation with valid data
- Token validation logic
- Expiration checking

**AuthenticationService**
- `requestPasswordReset()` with valid email
- `requestPasswordReset()` with non-existent email (should not reveal)
- `requestPasswordReset()` with invalid email format
- `resetPassword()` with valid token and password
- `resetPassword()` with expired token
- `resetPassword()` with invalid token
- `resetPassword()` with weak password
- `validateResetToken()` with various token states

**DrizzlePasswordResetRepository**
- Create password reset token
- Find token by hash
- Delete token by hash
- Delete expired tokens
- Handle database constraints and errors

**MailgunEmailService**
- Send password reset email successfully
- Handle Mailgun API errors
- Retry logic for failed sends
- Email template rendering

### Integration Tests

**Password Reset Flow**
- Complete end-to-end password reset journey
- Request reset → receive email → reset password → login
- Token expiration handling in full flow
- Rate limiting enforcement across requests

**Database Integration**
- Repository operations with real database
- Foreign key constraints with user deletion
- Index performance for token lookups
- Migration execution and rollback

**Email Service Integration**
- Mailgun API communication with test credentials
- Email delivery confirmation
- Error handling for service outages

### Feature Tests

**Forgot Password Form**
- Form submission with valid email
- Form validation for invalid emails
- Success message display (without revealing email existence)
- Rate limiting feedback to user

**Reset Password Form**
- Valid token displays form correctly
- Invalid/expired token shows appropriate error
- Password validation and confirmation
- Successful reset redirects to login

**Security Tests**
- Token uniqueness across multiple users
- Token cannot be reused after successful reset
- Expired tokens are properly rejected
- Rate limiting prevents abuse
- No email enumeration attacks possible

## Mocking Requirements

- **Mailgun API:** Mock email sending for unit tests, use test API for integration
- **Time/Date:** Mock Date.now() for testing token expiration scenarios
- **Crypto:** Mock randomBytes for predictable token generation in tests
- **Database:** Use test database with proper cleanup between tests