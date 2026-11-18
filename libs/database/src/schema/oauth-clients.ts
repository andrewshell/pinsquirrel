import {
  mysqlTable,
  varchar,
  timestamp,
  json,
  mysqlEnum,
  index,
} from 'drizzle-orm/mysql-core'

export const oauthClients = mysqlTable(
  'oauth_clients',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    // The identifier the client sends on every request, and what the codes
    // and tokens below point at. Unique, so it can carry those foreign keys
    // without a join on the hot path. Binary: MySQL's default collation
    // ignores case and accents, and CIMD compares client ids by simple string
    // comparison (draft-ietf-oauth-client-id-metadata-document, section 3).
    clientId: varchar('client_id', { length: 255 })
      .collate('utf8mb4_bin')
      .notNull()
      .unique(),
    clientName: varchar('client_name', { length: 255 }),
    redirectUris: json('redirect_uris').$type<string[]>().notNull(),
    grantTypes: json('grant_types').$type<string[]>().notNull(),
    tokenEndpointAuthMethod: varchar('token_endpoint_auth_method', {
      length: 64,
    }).notNull(),
    registrationType: mysqlEnum('registration_type', [
      'cimd',
      'dcr',
      'static',
    ]).notNull(),
    metadataUrl: varchar('metadata_url', { length: 512 }),
    metadataFetchedAt: timestamp('metadata_fetched_at', {
      mode: 'date',
      fsp: 3,
    }),
    completedAt: timestamp('completed_at', { mode: 'date', fsp: 3 }),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 3 })
      .defaultNow()
      .notNull(),
  },
  table => ({
    incompleteIdx: index('oauth_clients_incomplete_idx').on(
      table.registrationType,
      table.completedAt,
      table.createdAt
    ),
  })
)
