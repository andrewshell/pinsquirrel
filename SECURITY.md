# Security Policy

## Supported Versions

We support the following versions of PinSquirrel with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of PinSquirrel seriously. If you have discovered a security vulnerability, please follow these steps:

### 1. Do NOT Create a Public Issue

Please do not create a public GitHub issue for security vulnerabilities, as this could put users at risk.

### 2. Contact Us Privately

Send an email to andrew@pinsquirrel.com with:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days for critical issues

### 4. Disclosure Process

1. We will acknowledge receipt of your report
2. We will investigate and validate the issue
3. We will develop and test a fix
4. We will release a patch
5. We will publicly disclose the vulnerability (crediting you, unless you prefer to remain anonymous)

## Security Best Practices for Users

### Environment Variables

- Never commit `.env` files to version control
- Use strong, unique values for:
  - `SESSION_SECRET`
  - `INVITE_CODE`
- Rotate secrets regularly

### Database Security

- Keep your SQLite database file secure
- Regular backups are recommended
- Ensure proper file permissions on the database

### Authentication

- Users' emails are hashed for privacy
- Passwords are properly hashed using bcrypt
- Sessions expire after 7 days

### Dependencies

- Keep dependencies up to date: `pnpm update`
- Regularly audit for vulnerabilities: `pnpm audit`

## Security Features

PinSquirrel includes several security features:

1. **Password Hashing**: Using bcrypt with appropriate salt rounds
2. **Email Privacy**: Email addresses are hashed in the database
3. **Session Management**: Secure, HTTP-only cookies with HMAC signatures
4. **CSRF Protection**: SameSite cookie attributes
5. **Input Validation**: Server-side validation on all inputs
6. **SQL Injection Protection**: Parameterized queries via Drizzle ORM

## Acknowledgments

We appreciate the security research community and will acknowledge reporters who help us maintain the security of PinSquirrel (unless they prefer to remain anonymous).

## Contact

Security Email: andrew@pinsquirrel.com

For non-security issues, please use the [issue tracker](https://github.com/andrewshell/pinsquirrel/issues).
