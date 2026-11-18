import type { Pool, PoolConnection } from 'mysql2/promise'

/**
 * Row builders for the integration tests.
 *
 * The tests used to hand-write an `INSERT INTO users`/`INSERT INTO pins` per
 * case, and those column lists drifted — several omitted `email_encrypted` or
 * `status` entirely. Inserting through these helpers keeps every fixture row
 * on the full column list, so a new column is added in one place.
 */

export type InsertUserOptions = {
  id?: string
  username?: string
  passwordHash?: string | null
  emailHash?: string | null
  emailEncrypted?: string | null
  status?: 'unverified' | 'waitlist' | 'active'
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type InsertedUser = {
  id: string
  username: string
}

export async function insertUser(
  pool: Pool,
  options: InsertUserOptions = {}
): Promise<InsertedUser> {
  const id = options.id ?? crypto.randomUUID()
  const username =
    options.username ?? `testuser-${crypto.randomUUID().slice(0, 8)}`

  await pool.query(
    `INSERT INTO users
       (id, username, password_hash, email_hash, email_encrypted, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      username,
      options.passwordHash ?? 'hashed_password',
      options.emailHash ?? 'hashed_email',
      options.emailEncrypted ?? null,
      options.status ?? 'unverified',
      options.createdAt ?? new Date(),
      options.updatedAt ?? options.createdAt ?? new Date(),
    ]
  )

  return { id, username }
}

export type InsertPinOptions = {
  userId: string
  url: string
  id?: string
  title?: string
  description?: string | null
  readLater?: boolean
  isPrivate?: boolean
  createdAt?: string
  updatedAt?: string
}

export async function insertPin(
  pool: Pool,
  options: InsertPinOptions
): Promise<string> {
  const id = options.id ?? crypto.randomUUID()

  await pool.query(
    `INSERT INTO pins
       (id, user_id, url, url_hash, title, description, read_later, is_private, created_at, updated_at)
     VALUES (?, ?, ?, MD5(?), ?, ?, ?, ?, ?, ?)`,
    [
      id,
      options.userId,
      options.url,
      options.url,
      options.title ?? 'Test Pin',
      options.description ?? null,
      options.readLater ?? false,
      options.isPrivate ?? false,
      options.createdAt ?? new Date(),
      options.updatedAt ?? options.createdAt ?? new Date(),
    ]
  )

  return id
}

/**
 * An open transaction that InnoDB will not pick as the victim of a deadlock
 * with a repository call: it has changed more rows than the call will. The
 * caller takes the locks that make the cycle, then rolls it back and releases
 * it. The column it changes has no index, so it locks its own rows and no gap
 * a second one would insert into.
 */
export async function heavyTransaction(pool: Pool): Promise<PoolConnection> {
  const bystanders = await Promise.all(
    Array.from({ length: 20 }, () =>
      insertUser(pool, { emailHash: crypto.randomUUID() })
    )
  )
  const connection = await pool.getConnection()
  await connection.beginTransaction()
  for (const bystander of bystanders) {
    await connection.query(
      "UPDATE users SET password_hash = CONCAT(password_hash, '.') WHERE id = ?",
      [bystander.id]
    )
  }
  return connection
}
