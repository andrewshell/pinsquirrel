import { useLoaderData, useActionData, data } from 'react-router'
import type { Route } from './+types/tags.merge'
import { requireAccessControl, setFlashMessage } from '~/lib/session.server'
import { tagService } from '~/lib/services/container.server'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { parseFormData } from '~/lib/http-utils'
import { logger } from '~/lib/logger.server'
import { TagMergeForm } from '~/components/tags/TagMergeForm'

export function meta(_: Route.MetaArgs) {
  return [
    {
      title: 'Merge Tags - PinSquirrel',
    },
    {
      name: 'description',
      content: 'Merge multiple tags into a single tag on PinSquirrel.',
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  // Ensure user is authenticated
  const ac = await requireAccessControl(request)

  // Fetch all user's tags for the form
  const userTags = await tagService.getUserTagsWithCount(ac, ac.user!.id)

  // Filter out tags with no pins
  const tagsWithPins = userTags.filter(tag => tag.pinCount > 0)

  return data({
    tags: tagsWithPins,
  })
}

export async function action({ request }: Route.ActionArgs) {
  // Ensure user is authenticated
  const ac = await requireAccessControl(request)

  // Parse form data
  const formData = await parseFormData(request)
  const sourceTagIds = formData.sourceTagIds
  const destinationTagId = formData.destinationTagId

  // Basic validation
  if (!sourceTagIds || !destinationTagId) {
    return data(
      {
        errors: {
          _form: ['Please select source tags and a destination tag.'],
        },
      },
      { status: 400 }
    )
  }

  // Parse source tag IDs (could be comma-separated string or array)
  let parsedSourceTagIds: string[]
  try {
    if (typeof sourceTagIds === 'string') {
      parsedSourceTagIds = sourceTagIds.split(',').filter(id => id.trim())
    } else if (Array.isArray(sourceTagIds)) {
      parsedSourceTagIds = sourceTagIds.filter(
        id => typeof id === 'string' && id.trim()
      )
    } else {
      parsedSourceTagIds = []
    }
  } catch {
    logger.debug('Failed to parse source tag IDs', { sourceTagIds })
    return data(
      {
        errors: {
          _form: ['Invalid source tags format.'],
        },
      },
      { status: 400 }
    )
  }

  if (parsedSourceTagIds.length === 0) {
    return data(
      {
        errors: {
          _form: ['Please select at least one source tag.'],
        },
      },
      { status: 400 }
    )
  }

  const destinationTagIdStr =
    typeof destinationTagId === 'string' ? destinationTagId : ''
  if (!destinationTagIdStr || !destinationTagIdStr.trim()) {
    return data(
      {
        errors: {
          _form: ['Please select a destination tag.'],
        },
      },
      { status: 400 }
    )
  }

  // Check if destination tag is in source tags
  if (parsedSourceTagIds.includes(destinationTagIdStr)) {
    return data(
      {
        errors: {
          _form: ['Destination tag cannot be one of the source tags.'],
        },
      },
      { status: 400 }
    )
  }

  try {
    // Perform the merge operation
    await tagService.mergeTags(ac, parsedSourceTagIds, destinationTagIdStr)

    logger.info('Tags merged successfully', {
      userId: ac.user!.id,
      sourceTagIds: parsedSourceTagIds,
      destinationTagId: destinationTagIdStr,
    })

    // Redirect back to tags page with success message
    return setFlashMessage(
      request,
      'success',
      'Tags merged successfully!',
      '/tags'
    )
  } catch (error) {
    logger.exception(error, 'Failed to merge tags', {
      userId: ac.user!.id,
      sourceTagIds: parsedSourceTagIds,
      destinationTagId: destinationTagIdStr,
    })

    return data(
      {
        errors: {
          _form: ['Failed to merge tags. Please try again.'],
        },
      },
      { status: 400 }
    )
  }
}

export default function TagsMergePage() {
  const { tags } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()

  // Build back link to tags page
  const backToTagsUrl = '/tags'

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to={backToTagsUrl}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tags
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Merge Tags</CardTitle>
          <p className="text-sm text-muted-foreground">
            Merge multiple tags into a single tag. All pins associated with the
            source tags will be moved to the destination tag.
          </p>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No tags with pins available to merge.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-4">
                <Link to={backToTagsUrl}>Back to Tags</Link>
              </Button>
            </div>
          ) : (
            <TagMergeForm
              tags={tags}
              errorMessage={
                actionData?.errors?._form
                  ? Array.isArray(actionData.errors._form)
                    ? actionData.errors._form.join(', ')
                    : actionData.errors._form
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
