export function createPasswordResetEmailTemplate(resetUrl: string): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reset Your PinSquirrel Password</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 8px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Reset Your PinSquirrel Password</h1>
        </div>
        
        <p>Hello,</p>
        
        <p>We received a request to reset your PinSquirrel password. If you made this request, click the button below to set a new password:</p>
        
        <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
        </p>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
        
        <p>This link will expire in 15 minutes for security reasons.</p>
        
        <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        
        <div class="footer">
            <p>Best regards,<br>The PinSquirrel Team</p>
            <p><small>This is an automated email. Please do not reply to this message.</small></p>
        </div>
    </div>
</body>
</html>`.trim()

  const text = `
Reset Your PinSquirrel Password

Hello,

We received a request to reset your PinSquirrel password. If you made this request, visit the following link to set a new password:

${resetUrl}

This link will expire in 15 minutes for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The PinSquirrel Team

This is an automated email. Please do not reply to this message.
`.trim()

  return { html, text }
}