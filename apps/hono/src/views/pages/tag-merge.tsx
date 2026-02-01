import type { TagWithCount, User } from '@pinsquirrel/domain'
import type { FlashMessage } from '../../middleware/session'
import {
  ErrorMessage,
  FlashMessage as FlashMessageComponent,
} from '../components/FlashMessage'
import { TagSelectDropdown } from '../components/TagSelectDropdown'
import { DefaultLayout } from '../layouts/default'

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
    <DefaultLayout
      title="Merge Tags"
      user={user}
      currentPath="/tags/merge"
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

        {/* Tags data for JS merge summary calculation */}
        <script
          type="application/json"
          id="tags-data"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              tags.map((t) => ({
                id: t.id,
                name: t.name,
                pinCount: t.pinCount,
              }))
            ),
          }}
        />

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
            {formError && <ErrorMessage message={formError} className="mb-6" />}

            {/* Source tags selection */}
            <div class="mb-6">
              <label class="block text-sm font-medium text-foreground mb-2">
                Source Tags <span class="text-red-500">*</span>
              </label>
              <p class="text-sm text-muted-foreground mb-3">
                Select the tags you want to merge. These tags will be deleted
                after merging.
              </p>
              <TagSelectDropdown
                tags={tags}
                selectedIds={selectedSourceTags}
                multiple={true}
                name="sourceTagIds"
                placeholder="Select tags to merge..."
              />
            </div>

            {/* Destination tag selection */}
            <div class="mb-6">
              <label class="block text-sm font-medium text-foreground mb-2">
                Destination Tag <span class="text-red-500">*</span>
              </label>
              <p class="text-sm text-muted-foreground mb-3">
                Select the tag that will receive all pins from the source tags.
              </p>
              <TagSelectDropdown
                tags={tags}
                selectedIds={
                  selectedDestinationTag ? [selectedDestinationTag] : []
                }
                multiple={false}
                name="destinationTagId"
                placeholder="Select destination tag..."
                excludeSourceSelector="[name='sourceTagIds']"
              />
            </div>

            {/* Merge Summary - shown by JS when both source and destination are selected */}
            <div
              id="merge-summary"
              class="hidden mb-6 p-4 bg-muted/50 border-2 border-muted"
            >
              <h3 class="font-semibold text-foreground mb-2">Merge Summary</h3>
              <ul class="list-disc list-inside space-y-1 text-sm text-foreground">
                <li>
                  <span id="merge-summary-tag-count">0</span> source tag(s) will
                  be merged
                </li>
                <li>
                  <span id="merge-summary-pin-count">0</span> pin(s) will be
                  moved to the destination tag
                </li>
                <li>Source tags will be deleted after merging</li>
              </ul>
            </div>

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
    </DefaultLayout>
  )
}
