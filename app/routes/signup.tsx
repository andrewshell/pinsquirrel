import { Form, Link, redirect } from 'react-router';
import { Button } from '~/components/ui/button';
import { usersTable } from '~/db/schema/users';
import db from '~/lib/db';
import { eq } from 'drizzle-orm';
import { hashPassword, hashEmail } from '~/lib/auth';
import { z } from 'zod';
import config from '~/lib/config';

import type { Route } from './+types/signup';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  inviteCode: z.preprocess(
    (val) => (val === null ? '' : val),
    z.string().min(1, 'Invite code is required')
  ),
  terms: z.literal('on', {
    errorMap: () => ({ message: 'You must agree to the terms of service' }),
  }),
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
    inviteCode: formData.get('inviteCode'),
    terms: formData.get('terms'),
  };

  // Validate using Zod
  const result = signupSchema.safeParse(rawData);

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

  const { email, password, inviteCode } = result.data;

  // Check invite code
  if (inviteCode !== config.auth.inviteCode) {
    return {
      fieldErrors: { inviteCode: 'Invalid invite code' },
      error: 'Please check your invite code and try again',
    };
  }

  try {
    // Hash the email for storage and lookup
    const hashedEmail = hashEmail(email);

    // Check if user already exists
    const existingUser = await db.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, hashedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return {
        error: 'An account with this email already exists',
      };
    }

    // Hash the password
    const hashedPassword = hashPassword(password);

    // Create new user
    await db.db.insert(usersTable).values({
      email: hashedEmail,
      password: hashedPassword,
    });

    // Redirect to login page with success message
    return redirect('/login?message=Account created successfully');
  } catch {
    // Signup error - silent fail for security
    return {
      error: 'An error occurred creating your account. Please try again.',
    };
  }
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Sign Up - PinSquirrel' },
    {
      name: 'description',
      content:
        'Create your free PinSquirrel account and start hoarding links like nuts today.',
    },
  ];
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const fieldErrors = actionData?.fieldErrors || {};
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Join the squirrel pack
          </h1>
          <p className="mt-2 text-gray-600">
            Start hoarding your digital nuts today
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
                placeholder="Create a password"
              />
              {fieldErrors.password ? (
                <p className="mt-1 text-sm text-red-600">
                  {fieldErrors.password}
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  Must be at least 8 characters long
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="inviteCode"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Invite Code
              </label>
              <input
                id="inviteCode"
                name="inviteCode"
                type="text"
                required
                className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.inviteCode ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your invite code"
              />
              {fieldErrors.inviteCode && (
                <p className="mt-1 text-sm text-red-600">
                  {fieldErrors.inviteCode}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="terms"
                  className="ml-2 block text-sm text-gray-700"
                >
                  I agree to the{' '}
                  <Link
                    to="/terms"
                    className="text-blue-600 hover:text-blue-500"
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    to="/privacy"
                    className="text-blue-600 hover:text-blue-500"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {fieldErrors.terms && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.terms}</p>
              )}
            </div>

            <Button type="submit" className="w-full">
              Start hoarding
            </Button>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already a squirrel?{' '}
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
