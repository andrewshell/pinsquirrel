import { createHmac } from 'crypto';
import type { AuthenticatedUser } from './auth-utils';
import config from './config';

const SESSION_SECRET = config.auth.sessionSecret;
const SESSION_DURATION = config.auth.sessionDurationHours * 60 * 60 * 1000; // Convert hours to milliseconds

export interface SessionData extends AuthenticatedUser {
  iat: number; // issued at
  exp: number; // expires at
}

function base64urlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const paddedBase64 = base64 + '='.repeat(padding ? 4 - padding : 0);
  return Buffer.from(paddedBase64, 'base64').toString();
}

function sign(payload: string): string {
  return createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
}

export function createSessionToken(id: number, email: string): string {
  const now = Date.now();
  const sessionData: SessionData = {
    id,
    email,
    iat: now,
    exp: now + SESSION_DURATION,
  };

  const payload = base64urlEncode(JSON.stringify(sessionData));
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): SessionData | null {
  try {
    const [payload, signature] = token.split('.');

    if (!payload || !signature) {
      return null;
    }

    // Verify signature
    const expectedSignature = sign(payload);
    if (signature !== expectedSignature) {
      return null;
    }

    // Parse payload
    const sessionData: SessionData = JSON.parse(base64urlDecode(payload));

    // Check expiration
    if (Date.now() > sessionData.exp) {
      return null;
    }

    return sessionData;
  } catch {
    return null;
  }
}

export function createSessionCookie(id: number, email: string): string {
  const token = createSessionToken(id, email);
  const maxAge = Math.floor(SESSION_DURATION / 1000); // Convert to seconds

  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`;
}

export function clearSessionCookie(): string {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/';
}

export function getSessionFromRequest(request: Request): SessionData | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) => cookie.startsWith('session='));

  if (!sessionCookie) {
    return null;
  }

  const token = sessionCookie.split('=')[1];
  return verifySessionToken(token);
}
