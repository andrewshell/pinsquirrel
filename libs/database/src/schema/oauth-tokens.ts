import {
  mysqlTable,
  varchar,
  timestamp,
  json,
  mysqlEnum,
  index,
} from 'drizzle-orm/mysql-core'
import { oauthClients } from './oauth-clients'
import { users } from './users'

export const oauthTokens = mysqlTable(
  'oauth_tokens',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    // SHA-256 hex, the way every stored secret here is. The raw `pso_` token
    // is shown to the client once, in the token response, and never stored.
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    kind: mysqlEnum('kind', ['access', 'refresh']).notNull(),
    clientId: varchar('client_id', { length: 255 })
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopes: json('scopes').$type<string[]>().notNull(),
    // The RFC 8707 audience. Compared against the resource the request
    // arrived at, never defaulted: a token for /mcp must not drive /api/v1.
    resource: varchar('resource', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date', fsp: 3 }),
    rotatedAt: timestamp('rotated_at', { mode: 'date', fsp: 3 }),
    // The refresh token this one replaced. Deliberately not a foreign key
    // back to this table: the sweep deletes dead rows, and a self-referencing
    // constraint would either block that or quietly null out the chain the
    // column exists to record.
    rotatedFrom: varchar('rotated_from', { length: 36 }),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
  },
  table => ({
    // Same sweep, same reason as sessions_expires_at_idx.
    expiresAtIdx: index('oauth_tokens_expires_at_idx').on(table.expiresAt),
    // Serves both the grants list (user alone, on the index prefix) and
    // revoking one grant (user and client together).
    userClientIdx: index('oauth_tokens_user_client_idx').on(
      table.userId,
      table.clientId
    ),
    // Walking a rotation chain forward, to spot a replayed refresh token.
    rotatedFromIdx: index('oauth_tokens_rotated_from_idx').on(
      table.rotatedFrom
    ),
  })
)
