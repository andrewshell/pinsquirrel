import {
  mysqlTable,
  varchar,
  timestamp,
  json,
  index,
} from 'drizzle-orm/mysql-core'
import { oauthClients } from './oauth-clients'
import { users } from './users'

export const oauthAuthorizationCodes = mysqlTable(
  'oauth_authorization_codes',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    // SHA-256 hex, the way every stored secret here is. The raw code lived
    // only in the redirect that carried it.
    codeHash: varchar('code_hash', { length: 64 }).notNull().unique(),
    clientId: varchar('client_id', { length: 255 })
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    redirectUri: varchar('redirect_uri', { length: 512 }).notNull(),
    // PKCE S256 challenge: 43 base64url characters.
    codeChallenge: varchar('code_challenge', { length: 128 }).notNull(),
    scopes: json('scopes').$type<string[]>().notNull(),
    resource: varchar('resource', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    // Set by the single-use exchange. A code with this set has been spent;
    // presenting it again is a replay.
    consumedAt: timestamp('consumed_at', { mode: 'date', fsp: 3 }),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
  },
  table => ({
    // Same sweep, same reason as sessions_expires_at_idx.
    expiresAtIdx: index('oauth_authorization_codes_expires_at_idx').on(
      table.expiresAt
    ),
  })
)
