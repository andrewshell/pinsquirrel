import type { TagWithCount, User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import {
  FlashMessage as FlashMessageComponent,
  ErrorMessage,
  WarningMessage,
} from '../components/FlashMessage'
import type { FlashMessage } from '../../middleware/session'

interface TagMergePageProps {
  user: User
  tags: TagWithCount[]
  flash?: FlashMessage | null
  errors?: Record<string, string[]>
  selectedSourceTags?: string[]
  selectedDestinationTag?: string
}

export function TagMergePage({
  user,
  tags,
  flash,
  errors,
  selectedSourceTags = [],
  selectedDestinationTag = '',
}: TagMergePageProps) {
  const formError = errors?._form?.[0]

  return (
    <DefaultLayout title="Merge Tags" user={user} currentPath="/tags/merge">
      <div class="container mx-auto px-4 py-8 max-w-2xl">
        {/* Flash message */}
        {flash && (
          <FlashMessageComponent
            type={flash.type}
            message={flash.message}
            className="mb-6"
          />
        )}

        {/* Back link */}
        <div class="mb-6">
          <a
            href="/tags"
            class="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
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
            Back to Tags
          </a>
        </div>

        {/* Card */}
        <div class="bg-card border-2 border-foreground neobrutalism-shadow p-6">
          <h1 class="text-2xl font-bold text-foreground mb-2">Merge Tags</h1>
          <p class="text-muted-foreground mb-6">
            Merge multiple tags into a single tag. All pins associated with the
            source tags will be moved to the destination tag.
          </p>

          {tags.length < 2 ? (
            <div class="text-center py-8">
              <p class="text-muted-foreground mb-4">
                You need at least 2 tags to perform a merge.
              </p>
              <a
                href="/tags"
                class="inline-block px-4 py-2 bg-secondary text-secondary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                       hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                       transition-all"
              >
                Back to Tags
              </a>
            </div>
          ) : (
            <form method="post" action="/tags/merge">
              {/* Form error */}
              {formError && (
                <ErrorMessage message={formError} className="mb-6" />
              )}

              {/* Source tags selection */}
              <div class="mb-6">
                <label class="block text-sm font-medium text-foreground mb-2">
                  Source Tags <span class="text-red-500">*</span>
                </label>
                <p class="text-sm text-muted-foreground mb-3">
                  Select the tags you want to merge. These tags will be deleted
                  after merging.
                </p>
                <div class="space-y-2 max-h-64 overflow-y-auto border-2 border-muted p-3">
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      class="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="sourceTagIds"
                        value={tag.id}
                        checked={selectedSourceTags.includes(tag.id)}
                        class="h-4 w-4 border-2 border-foreground"
                      />
                      <span class="flex-1">{tag.name}</span>
                      <span class="text-sm text-muted-foreground">
                        ({tag.pinCount} pin{tag.pinCount === 1 ? '' : 's'})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Destination tag selection */}
              <div class="mb-6">
                <label
                  for="destinationTagId"
                  class="block text-sm font-medium text-foreground mb-2"
                >
                  Destination Tag <span class="text-red-500">*</span>
                </label>
                <p class="text-sm text-muted-foreground mb-3">
                  Select the tag that will receive all pins from the source
                  tags.
                </p>
                <select
                  id="destinationTagId"
                  name="destinationTagId"
                  class="w-full px-3 py-2 border-2 border-foreground bg-background text-foreground"
                  required
                >
                  <option value="">Select destination tag...</option>
                  {tags.map((tag) => (
                    <option
                      key={tag.id}
                      value={tag.id}
                      selected={selectedDestinationTag === tag.id}
                    >
                      {tag.name} ({tag.pinCount} pin
                      {tag.pinCount === 1 ? '' : 's'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Warning */}
              <WarningMessage
                message="Warning: This action cannot be undone. Source tags will be permanently deleted after merging."
                className="mb-6"
              />

              {/* Submit button */}
              <div class="flex gap-4">
                <button
                  type="submit"
                  class="px-6 py-3 bg-primary text-primary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                         hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                         active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                         transition-all"
                >
                  Merge Tags
                </button>
                <a
                  href="/tags"
                  class="px-6 py-3 bg-secondary text-secondary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                         hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                         active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                         transition-all"
                >
                  Cancel
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </DefaultLayout>
  )
}
