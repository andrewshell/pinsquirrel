export interface EmailService {
  sendPasswordResetEmail(
    email: string,
    token: string,
    resetUrl: string
  ): Promise<void>
}
