import { redirect } from 'react-router';
import { getSessionFromRequest, type SessionData } from './session';

export interface AuthenticatedUser {
  id: number;
  email: string;
}

export function requireAuth(request: Request): SessionData {
  const session = getSessionFromRequest(request);

  if (!session) {
    throw redirect('/login?message=Please sign in to continue');
  }

  return session;
}

export function getOptionalAuth(request: Request): SessionData | null {
  return getSessionFromRequest(request);
}

export function redirectIfAuthenticated(
  request: Request,
  redirectTo: string = '/links'
): void {
  const session = getSessionFromRequest(request);

  if (session) {
    throw redirect(redirectTo);
  }
}

export function createAuthLoader<T = AuthenticatedUser>(
  loaderFn?: (args: {
    request: Request;
    params: Record<string, unknown>;
    user: AuthenticatedUser;
  }) => T | Promise<T>
) {
  return async ({
    request,
    params,
  }: {
    request: Request;
    params: Record<string, unknown>;
  }) => {
    const session = requireAuth(request);
    const user: AuthenticatedUser = {
      id: session.id,
      email: session.email,
    };

    if (loaderFn) {
      return await loaderFn({ request, params, user });
    }

    return user;
  };
}

export function createAuthAction<T = Response>(
  actionFn: (args: {
    request: Request;
    params: Record<string, unknown>;
    user: AuthenticatedUser;
  }) => T | Promise<T>
) {
  return async ({
    request,
    params,
  }: {
    request: Request;
    params: Record<string, unknown>;
  }) => {
    const session = requireAuth(request);
    const user: AuthenticatedUser = {
      id: session.id,
      email: session.email,
    };

    return await actionFn({ request, params, user });
  };
}
