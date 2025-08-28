export interface RegisterInput {
  username: string
  password: string
  email?: string | null
}

export interface LoginInput {
  username: string
  password: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export interface UpdateEmailInput {
  email: string | null
}
