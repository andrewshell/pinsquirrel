# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-18-forgot-password-flow/spec.md

> Created: 2025-08-18
> Version: 1.0.0

## Endpoints

### POST /forgot-password

**Purpose:** Request password reset for a given email address
**Parameters:** 
- `email` (body, required): Email address for password reset
**Response:** 
- Success: 200 OK with confirmation message
- Validation Error: 400 Bad Request with validation errors
- Rate Limited: 429 Too Many Requests
**Errors:** 
- Invalid email format
- Rate limit exceeded (3 requests per hour per email)

**Security Notes:**
- Always returns success response regardless of email existence (prevents email enumeration)
- Rate limiting prevents abuse
- Token generation uses cryptographically secure random bytes

### GET /reset-password/:token

**Purpose:** Display password reset form with token validation
**Parameters:**
- `token` (URL parameter, required): Password reset token from email
**Response:**
- Valid token: 200 OK with password reset form
- Invalid/expired token: 400 Bad Request with error message
**Errors:**
- Token not found
- Token expired
- Token already used

### POST /reset-password/:token

**Purpose:** Complete password reset with new password
**Parameters:**
- `token` (URL parameter, required): Password reset token
- `password` (body, required): New password
- `confirmPassword` (body, required): Password confirmation
**Response:**
- Success: 302 Redirect to login with success message
- Validation Error: 400 Bad Request with validation errors
**Errors:**
- Token not found/expired/used
- Password validation failed
- Password confirmation mismatch

## Service Methods

### AuthenticationService Extensions

**requestPasswordReset(email: string): Promise<void>**
- Validates email format
- Finds user by email hash
- Generates secure token (32 bytes)
- Stores hashed token with 15-minute expiration
- Sends reset email via EmailService
- Handles rate limiting logic

**resetPassword(token: string, newPassword: string): Promise<void>**
- Validates token format and existence
- Checks token expiration
- Validates new password requirements
- Updates user password hash
- Invalidates reset token
- Logs security event

**validateResetToken(token: string): Promise<boolean>**
- Checks token existence and expiration
- Returns validation status without exposing token details
- Used by GET /reset-password/:token route