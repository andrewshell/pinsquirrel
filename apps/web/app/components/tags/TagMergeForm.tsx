import { useState, useMemo } from 'react'
import { Form } from 'react-router'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { FormText } from '~/components/ui/form-text'
import { DismissibleAlert } from '~/components/ui/dismissible-alert'
import { TagMultiSelect } from '~/components/ui/tag-multi-select'
import { TagSelect } from '~/components/ui/tag-select'
import type { TagWithCount } from '@pinsquirrel/core'

interface TagMergeFormProps {
  tags: TagWithCount[]
  errorMessage?: string
}

export function TagMergeForm({ tags, errorMessage }: TagMergeFormProps) {
  const [selectedSourceTags, setSelectedSourceTags] = useState<string[]>([])
  const [selectedDestinationTag, setSelectedDestinationTag] =
    useState<string>('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Filter available destination tags (exclude selected source tags)
  const availableDestinationTags = useMemo(() => {
    return tags.filter(tag => !selectedSourceTags.includes(tag.id))
  }, [tags, selectedSourceTags])

  // Calculate total pins that will be affected
  const totalPinsAffected = useMemo(() => {
    const sourceTagsSet = new Set(selectedSourceTags)
    return tags
      .filter(tag => sourceTagsSet.has(tag.id))
      .reduce((total, tag) => total + tag.pinCount, 0)
  }, [tags, selectedSourceTags])

  const handleSourceTagsChange = (tagIds: string[]) => {
    setSelectedSourceTags(tagIds)
    // Clear destination tag if it's now in the source tags
    if (tagIds.includes(selectedDestinationTag)) {
      setSelectedDestinationTag('')
    }
  }

  const handleDestinationTagChange = (tagId: string) => {
    setSelectedDestinationTag(tagId)
  }

  const handleMergeClick = () => {
    if (selectedSourceTags.length > 0 && selectedDestinationTag) {
      setShowConfirmation(true)
    }
  }

  const handleConfirmMerge = () => {
    // This will submit the form
    const form = document.getElementById('tag-merge-form') as HTMLFormElement
    if (form) {
      form.submit()
    }
  }

  const isReadyToMerge = selectedSourceTags.length > 0 && selectedDestinationTag

  return (
    <>
      {errorMessage && (
        <DismissibleAlert
          message={errorMessage}
          type="error"
          className="mb-6"
        />
      )}

      <Form method="post" id="tag-merge-form">
        <div className="space-y-6">
          {/* Source Tags Selection */}
          <div className="space-y-2">
            <Label htmlFor="source-tags">
              Source Tags <span className="text-destructive">*</span>
            </Label>
            <TagMultiSelect
              id="source-tags"
              tags={tags}
              selectedTagIds={selectedSourceTags}
              onSelectionChange={handleSourceTagsChange}
              placeholder="Select tags to merge..."
            />
            <FormText>
              Select the tags you want to merge into another tag. These tags
              will be removed after merging.
            </FormText>
            <input
              type="hidden"
              name="sourceTagIds"
              value={selectedSourceTags.join(',')}
            />
          </div>

          {/* Destination Tag Selection */}
          <div className="space-y-2">
            <Label htmlFor="destination-tag">
              Destination Tag <span className="text-destructive">*</span>
            </Label>
            <TagSelect
              id="destination-tag"
              tags={availableDestinationTags}
              selectedTagId={selectedDestinationTag}
              onSelectionChange={handleDestinationTagChange}
              placeholder="Select destination tag..."
              disabled={selectedSourceTags.length === 0}
            />
            <FormText>
              Select the tag that will receive all pins from the source tags.
            </FormText>
            <input
              type="hidden"
              name="destinationTagId"
              value={selectedDestinationTag}
            />
          </div>

          {/* Summary */}
          {isReadyToMerge && (
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium text-sm mb-2">Merge Summary</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  • {selectedSourceTags.length} source tag(s) will be merged
                </li>
                <li>
                  • {totalPinsAffected} pin(s) will be moved to the destination
                  tag
                </li>
                <li>• Source tags will be deleted after merging</li>
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleMergeClick}
              disabled={!isReadyToMerge}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Merge Tags
            </Button>
          </div>
        </div>
      </Form>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Tag Merge</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to merge {selectedSourceTags.length} tag(s)
              into the selected destination tag? This will move{' '}
              {totalPinsAffected} pin(s) and permanently delete the source tags.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmMerge}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                Confirm Merge
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
