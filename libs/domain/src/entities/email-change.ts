/**
 * A change of address the user has asked for and not yet confirmed from the
 * new address. The address is held the way users hold theirs: hashed for
 * lookup and, when sealing is configured, sealed.
 */
export interface EmailChange {
  id: string
  userId: string
  tokenHash: string
  emailHash: string
  emailEncrypted: string | null
  expiresAt: Date
  createdAt: Date
}

export type CreateEmailChangeData = Omit<EmailChange, 'id' | 'createdAt'>
