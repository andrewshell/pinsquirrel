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

  sendEmailAlreadyRegisteredEmail(
    email: string,
    signinUrl: string
  ): Promise<void>

  sendUsernameTakenEmail(
    email: string,
    username: string,
    signupUrl: string
  ): Promise<void>
}
