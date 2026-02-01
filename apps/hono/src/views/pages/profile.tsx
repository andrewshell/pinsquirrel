import type { User } from '@pinsquirrel/domain'
import type { FlashMessage } from '../../middleware/session'
import {
  ErrorMessage,
  FlashMessage as FlashMessageComponent,
  SuccessMessage,
} from '../components/FlashMessage'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { DefaultLayout } from '../layouts/default'

interface ProfilePageProps {
  user: User
  flash?: FlashMessage | null
  errors?: Record<string, string[]>
  emailSuccess?: boolean
  passwordSuccess?: boolean
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProfilePage({
  user,
  flash,
  errors,
  emailSuccess,
  passwordSuccess,
}: ProfilePageProps) {
  const formError = errors?._form?.[0]

  return (
    <DefaultLayout
      title="Profile"
      user={user}
      currentPath="/profile"
      width="narrow"
    >
      {/* Flash message */}
      {flash && (
        <FlashMessageComponent
          type={flash.type}
          message={flash.message}
          className="mb-6"
        />
      )}

      {/* Page title */}
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-foreground">Profile</h1>
        <p class="mt-2 text-muted-foreground">
          Manage your account information
        </p>
      </div>

      <div class="space-y-6">
        {/* Account Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-foreground">
                Username
              </label>
              <div class="mt-1 text-sm text-muted-foreground">
                {user.username}
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground">
                User ID
              </label>
              <div class="mt-1 text-sm text-muted-foreground font-mono">
                {user.id}
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground">
                Account Created
              </label>
              <div class="mt-1 text-sm text-muted-foreground">
                {formatDate(user.createdAt)}
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground">
                Last Updated
              </label>
              <div class="mt-1 text-sm text-muted-foreground">
                {formatDate(user.updatedAt)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Update Email Card */}
        <Card>
          <CardHeader>
            <CardTitle>Update Email</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="post" action="/profile" class="space-y-4">
              <input type="hidden" name="intent" value="update-email" />

              {formError && <ErrorMessage message={formError} />}

              {emailSuccess && (
                <SuccessMessage message="Email updated successfully" />
              )}

              <div>
                <label
                  for="email"
                  class="block text-sm font-medium text-foreground mb-1"
                >
                  New Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  placeholder="Enter new email address"
                  class={`w-full px-3 py-2 border-2 border-foreground bg-background text-foreground ${
                    errors?.email ? 'border-red-500' : ''
                  }`}
                />
                {errors?.email && (
                  <p class="mt-1 text-sm text-red-600">{errors.email[0]}</p>
                )}
              </div>

              <Button type="submit">Update Email</Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="post" action="/profile" class="space-y-4">
              <input type="hidden" name="intent" value="change-password" />
              <input
                type="hidden"
                name="username"
                value={user.username}
                autocomplete="username"
              />

              {passwordSuccess && (
                <SuccessMessage message="Password changed successfully" />
              )}

              <div>
                <label
                  for="currentPassword"
                  class="block text-sm font-medium text-foreground mb-1"
                >
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autocomplete="current-password"
                  class={`w-full px-3 py-2 border-2 border-foreground bg-background text-foreground ${
                    errors?.currentPassword ? 'border-red-500' : ''
                  }`}
                />
                {errors?.currentPassword && (
                  <p class="mt-1 text-sm text-red-600">
                    {errors.currentPassword[0]}
                  </p>
                )}
              </div>

              <div>
                <label
                  for="newPassword"
                  class="block text-sm font-medium text-foreground mb-1"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autocomplete="new-password"
                  class={`w-full px-3 py-2 border-2 border-foreground bg-background text-foreground ${
                    errors?.newPassword ? 'border-red-500' : ''
                  }`}
                />
                {errors?.newPassword ? (
                  <p class="mt-1 text-sm text-red-600">
                    {errors.newPassword[0]}
                  </p>
                ) : (
                  <p class="mt-1 text-sm text-muted-foreground">
                    Must be at least 8 characters
                  </p>
                )}
              </div>

              <Button type="submit">Change Password</Button>
            </form>
          </CardContent>
        </Card>

        {/* Bookmarklet Section */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Pin Bookmarklet</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <p class="text-sm text-muted-foreground">
              Drag the bookmarklet below to your bookmarks bar to quickly pin
              any webpage you're visiting.
            </p>

            <div class="bg-muted rounded-lg p-4 border-2 border-dashed border-muted-foreground/25">
              <div class="text-center">
                {/* Bookmarklet link - href will be set by inline script */}
                <a
                  id="bookmarklet-link"
                  href="#"
                  class="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-move select-none"
                  draggable={true}
                  onclick="alert('Drag this link to your bookmarks bar instead of clicking it!'); return false;"
                >
                  📌 Pin to PinSquirrel
                </a>
              </div>
              <p class="text-xs text-muted-foreground text-center mt-2">
                ← Drag this to your bookmarks bar
              </p>
            </div>

            <div class="space-y-2 text-sm text-muted-foreground">
              <h4 class="font-medium text-foreground">How to use:</h4>
              <ol class="list-decimal list-inside space-y-1 ml-4">
                <li>
                  Drag the bookmarklet above to your browser's bookmarks bar
                </li>
                <li>Navigate to any webpage you want to pin</li>
                <li>
                  Click the bookmarklet while on any webpage to open a new tab
                  with the pin creation form pre-filled
                </li>
                <li>
                  If you have text selected on the page, it will be used as the
                  description (converted from HTML to markdown)
                </li>
                <li>Review and save your pin</li>
              </ol>
            </div>

            <Alert variant="info">
              <AlertTitle>Tip</AlertTitle>
              <AlertDescription>
                Select text on a webpage before clicking the bookmarklet to use
                that text as your pin's description. The selected text will be
                converted to markdown format automatically.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Inline script to set bookmarklet href */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
        (function() {
          var jsCode = '(function() {' +
            'var url = location.href;' +
            'var title = document.title;' +
            'var metaDesc = document.querySelector("meta[name=\\\\"description\\\\"]");' +
            'var pageDescription = metaDesc ? metaDesc.getAttribute("content") : "";' +
            'var selection = window.getSelection().toString();' +
            'var description = "";' +
            'if (selection.trim()) {' +
            '  description = selection' +
            '    .replace(/<br\\\\s*\\\\/?>/gi, "\\\\n")' +
            '    .replace(/<\\\\/p>/gi, "\\\\n\\\\n")' +
            '    .replace(/<p[^>]*>/gi, "")' +
            '    .replace(/<strong[^>]*>(.*?)<\\\\/strong>/gi, "**$1**")' +
            '    .replace(/<b[^>]*>(.*?)<\\\\/b>/gi, "**$1**")' +
            '    .replace(/<em[^>]*>(.*?)<\\\\/em>/gi, "*$1*")' +
            '    .replace(/<i[^>]*>(.*?)<\\\\/i>/gi, "*$1*")' +
            '    .replace(/<a[^>]*href=\\\\"([^\\\\"]*)\\\\"[^>]*>(.*?)<\\\\/a>/gi, "[$2]($1)")' +
            '    .replace(/<[^>]*>/g, "")' +
            '    .trim();' +
            '} else {' +
            '  description = pageDescription;' +
            '}' +
            'var params = new URLSearchParams({' +
            '  url: url,' +
            '  title: title,' +
            '  description: description' +
            '});' +
            'var targetUrl = "' + window.location.origin + '/pins/new?" + params.toString();' +
            'window.open(targetUrl, "_blank");' +
            '})();';
          var link = document.getElementById('bookmarklet-link');
          if (link) {
            link.setAttribute('href', 'javascript:' + encodeURIComponent(jsCode));
          }
        })();
      `,
        }}
      />
    </DefaultLayout>
  )
}
