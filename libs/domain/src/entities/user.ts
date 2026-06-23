import type { Role } from './role.js'
import type { UserStatus } from './user-status.js'

export interface User {
  id: string
  username: string
  passwordHash: string | null
  emailHash: string | null
  // Email sealed to the admin public key (X25519 sealed box) so the waitlist
  // can be contacted. Null when no public key is configured. The server cannot
  // decrypt this — only the offline admin app with the private key can.
  emailEncrypted: string | null
  roles: Role[]
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

// These are for the repository layer - they work with hashed data.
// - status is omitted: new users always default to UserStatus.Unverified
// - emailEncrypted is optional: sealing only happens when a public key is
//   configured, so callers may omit it (defaults to null)
export type CreateUserData = Omit<
  User,
  'id' | 'roles' | 'status' | 'emailEncrypted' | 'createdAt' | 'updatedAt'
> & { emailEncrypted?: string | null }

export type UpdateUserData = Partial<
  Omit<User, 'id' | 'roles' | 'createdAt' | 'updatedAt'>
>
