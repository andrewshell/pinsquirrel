export interface PasswordResetToken {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  createdAt: Date
}

export interface CreatePasswordResetTokenData {
  userId: string
  tokenHash: string
  expiresAt: Date
}
