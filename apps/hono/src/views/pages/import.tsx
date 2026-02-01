import type { FC } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import { FlashMessage as FlashMessageComponent } from '../components/FlashMessage'
import type { FlashMessage } from '../../middleware/session'

interface ImportPageProps {
  user: User
  flash?: FlashMessage | null
  errors?: Record<string, string[]>
  success?: boolean
  message?: string
}

export const ImportPage: FC<ImportPageProps> = ({
  user,
  flash,
  errors,
  success,
  message,
}) => {
  const formError = errors?._form?.[0]

  return (
    <DefaultLayout title="Import Bookmarks" user={user} currentPath="/import">
      <div class="container max-w-4xl mx-auto px-4 py-8">
        <div class="mb-6">
          <a
            href="/pins"
            class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              class="mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            Back to Pins
          </a>
        </div>

        {/* Flash message */}
        {flash && (
          <FlashMessageComponent
            type={flash.type}
            message={flash.message}
            className="mb-6"
          />
        )}

        <div class="bg-card border-2 border-foreground neobrutalism-shadow">
          <div class="p-6 border-b-2 border-foreground">
            <h1 class="text-2xl font-bold">Import from Pinboard</h1>
          </div>

          <div class="p-6 space-y-6">
            <div class="prose prose-sm text-muted-foreground">
              <p>
                Upload your Pinboard export file to import all your bookmarks
                into PinSquirrel.
              </p>
              <p>To export from Pinboard:</p>
              <ol class="list-decimal pl-6 space-y-1">
                <li>Go to Pinboard Settings</li>
                <li>Click on "Backup" in the menu</li>
                <li>Download the JSON format export</li>
                <li>Upload the file below</li>
              </ol>
            </div>

            {/* Error message */}
            {formError && (
              <div class="p-4 border-2 border-red-500 bg-red-50 dark:bg-red-950">
                <div class="flex items-start gap-3">
                  <svg
                    class="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" x2="12" y1="8" y2="12" />
                    <line x1="12" x2="12.01" y1="16" y2="16" />
                  </svg>
                  <div>
                    <h3 class="font-semibold text-red-800 dark:text-red-200">
                      Import Failed
                    </h3>
                    <p class="text-red-700 dark:text-red-300">{formError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success message */}
            {success && message && (
              <div class="p-4 border-2 border-green-500 bg-green-50 dark:bg-green-950">
                <div class="flex items-start gap-3">
                  <svg
                    class="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <div>
                    <h3 class="font-semibold text-green-800 dark:text-green-200">
                      Import Successful
                    </h3>
                    <p class="text-green-700 dark:text-green-300">{message}</p>
                  </div>
                </div>
              </div>
            )}

            <form method="post" enctype="multipart/form-data" class="space-y-4">
              <div class="space-y-2">
                <label for="file" class="block font-medium text-foreground">
                  Pinboard Export File
                </label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".json,application/json"
                  required
                  class="block w-full text-sm text-foreground
                         file:mr-4 file:py-2 file:px-4
                         file:border-2 file:border-foreground
                         file:text-sm file:font-medium
                         file:bg-primary file:text-primary-foreground
                         file:cursor-pointer
                         hover:file:bg-primary/90
                         cursor-pointer"
                />
                <p class="text-sm text-muted-foreground">
                  Select your pinboard_export.json file (max 10MB)
                </p>
              </div>

              <div>
                <button
                  type="submit"
                  class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                         hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                         active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                         transition-all"
                >
                  <svg
                    class="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  Import Bookmarks
                </button>
              </div>
            </form>

            <div class="p-4 border-2 border-foreground bg-muted/50">
              <div class="flex items-start gap-3">
                <svg
                  class="h-5 w-5 text-foreground mt-0.5 flex-shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
                <div>
                  <h3 class="font-semibold text-foreground">Note</h3>
                  <p class="text-muted-foreground">
                    This import will add new pins to your collection. Existing
                    pins will not be affected. Duplicate URLs will be skipped.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
}
