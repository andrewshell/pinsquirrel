import { Form, Link, redirect } from 'react-router';
import { Button } from '~/components/ui/button';
import { usersTable } from '~/db/schema/users';
import db from '~/lib/db';
import { eq } from 'drizzle-orm';
import { verifyPassword, hashEmail } from '~/lib/auth';
import { createSessionCookie } from '~/lib/session';
import { z } from 'zod';

import type { Route } from './+types/login';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  // Validate using Zod
  const result = loginSchema.safeParse(rawData);

  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    result.error.errors.forEach((error) => {
      if (error.path.length > 0) {
        fieldErrors[error.path[0] as string] = error.message;
      }
    });

    return {
      fieldErrors,
      error: 'Please fix the errors below',
    };
  }

  const { email, password } = result.data;

  try {
    // Hash the email for database lookup
    const hashedEmail = hashEmail(email);

    // Find user by hashed email
    const users = await db.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, hashedEmail))
      .limit(1);

    if (users.length === 0) {
      return {
        error: 'Invalid email or password',
      };
    }

    const user = users[0];

    // Verify password
    const isValidPassword = verifyPassword(password, user.password);

    if (!isValidPassword) {
      return {
        error: 'Invalid email or password',
      };
    }

    // Create session and redirect (use original email for display purposes)
    const sessionCookie = createSessionCookie(user.id, email);

    return redirect('/links', {
      headers: {
        'Set-Cookie': sessionCookie,
      },
    });
  } catch {
    // Login error - silent fail for security
    return {
      error: 'An error occurred during login. Please try again.',
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Login - PinSquirrel' },
    {
      name: 'description',
      content:
        'Sign in to your PinSquirrel account to access your hoarded links.',
    },
  ];
}

export default function Login({ actionData }: Route.ComponentProps) {
  const fieldErrors = actionData?.fieldErrors || {};
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, squirrel!
          </h1>
          <p className="mt-2 text-gray-600">
            Sign in to access your link collection
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md border">
          <Form method="post" className="space-y-6">
            {actionData?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {actionData.error}
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
              />
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Remember me
                </label>
              </div>

              <a href="#" className="text-sm text-blue-600 hover:text-blue-500">
                Forgot password?
              </a>
            </div>

            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              New to PinSquirrel?{' '}
              <Link
                to="/signup"
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                Start hoarding links
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
