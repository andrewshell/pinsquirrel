import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import { createAuthLoader, createAuthAction } from '~/lib/auth-utils';
import { clearSessionCookie } from '~/lib/session';

import type { Route } from './+types/links';

export const loader = createAuthLoader();

export const action = createAuthAction(async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'logout') {
    throw new Response(null, {
      status: 302,
      headers: {
        Location: '/login?message=You have been logged out',
        'Set-Cookie': clearSessionCookie(),
      },
    });
  }

  return null;
});

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'My Links - PinSquirrel' },
    {
      name: 'description',
      content: 'Manage your hoarded links and collections.',
    },
  ];
}

export default function Links({ loaderData }: Route.ComponentProps) {
  const user = loaderData;

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Links</h1>
              <p className="text-gray-600 mt-1">Welcome back, {user.email}!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Collections
              </h2>
              <nav className="space-y-2">
                <Link
                  to="/links"
                  className="block px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-md"
                >
                  All Links
                </Link>
                <Link
                  to="/links/reading-list"
                  className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                >
                  Reading List
                </Link>
                <Link
                  to="/links/favorites"
                  className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                >
                  Favorites
                </Link>
                <Link
                  to="/links/feeds"
                  className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                >
                  RSS Feeds
                </Link>
              </nav>

              <hr className="my-4" />

              <h3 className="text-sm font-medium text-gray-900 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  development
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  design
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  productivity
                </span>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* View Toggles */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 10h16M4 14h16M4 18h16"
                    />
                  </svg>
                  List
                </Button>
                <Button variant="ghost" size="sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  Grid
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <select className="border border-gray-300 rounded-md px-3 py-1 text-sm">
                  <option>Sort by Date Added</option>
                  <option>Sort by Title</option>
                  <option>Sort by Most Visited</option>
                </select>
              </div>
            </div>

            {/* Links List */}
            <div className="space-y-4">
              {/* Placeholder links */}
              <div className="bg-white rounded-lg shadow-md border p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      <a href="#" className="hover:text-blue-600">
                        Welcome to PinSquirrel - Getting Started Guide
                      </a>
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">
                      Learn how to make the most of your link hoarding with
                      PinSquirrel&apos;s powerful features...
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>pinsquirrel.com</span>
                      <span>•</span>
                      <span>Added 2 days ago</span>
                      <span>•</span>
                      <div className="flex gap-1">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          tutorial
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                          getting-started
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                    </Button>
                    <Button variant="ghost" size="sm">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Empty state */}
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No more links
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by adding your first link to your collection.
                </p>
                <div className="mt-6">
                  <Button>Add your first link</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
