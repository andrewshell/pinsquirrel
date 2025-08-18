# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-18-forgot-password-flow/spec.md

> Created: 2025-08-18
> Version: 1.0.0

## New Table: password_reset_tokens

```sql
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

## Drizzle Schema Implementation

```typescript
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

## Indexes and Constraints

- **Primary Key:** `id` - Unique identifier for each token
- **Foreign Key:** `user_id` references `users.id` with CASCADE delete
- **Unique Constraint:** `token_hash` - Ensures token uniqueness
- **Index on user_id:** For efficient user token lookups
- **Index on token_hash:** For fast token validation
- **Index on expires_at:** For efficient cleanup of expired tokens

## Migration Strategy

1. Create new table with proper constraints and indexes
2. No data migration needed (new feature)
3. Add cleanup job for expired tokens (future enhancement)

## Data Integrity Rules

- Tokens automatically deleted when user is deleted (CASCADE)
- Token hash must be unique across all tokens
- Expiration time must be in the future when created
- One-time use tokens (deleted after successful password reset)