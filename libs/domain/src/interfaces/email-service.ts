export interface EmailService {
  sendPasswordResetEmail(
    email: string,
    token: string,
    resetUrl: string
  ): Promise<void>

  sendSignupNotificationEmail(
    notifyEmail: string,
    username: string,
    userEmail: string
  ): Promise<void>

  /** Carries a set-password link built like sendPasswordResetEmail's. */
  sendEmailAlreadyRegisteredEmail(
    email: string,
    signinUrl: string,
    token: string,
    resetUrl: string
  ): Promise<void>

  sendUsernameTakenEmail(
    email: string,
    username: string,
    signupUrl: string
  ): Promise<void>
}
