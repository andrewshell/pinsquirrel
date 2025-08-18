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

export interface PasswordResetRequest {
  email: string
}

export interface PasswordResetConfirmation {
  token: string
  newPassword: string
}