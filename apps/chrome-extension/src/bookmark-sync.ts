/**
 * The one-way mirror from PinSquirrel tags into Chrome bookmark folders.
 *
 * Decision 4: sync runs in one direction only. PinSquirrel is the truth, the
 * bookmark tree is a copy of it, and nothing here writes back over the API -
 * so a bookmark a user deleted by hand comes back on the next run, and an
 * edited title is overwritten.
 */

/**
 * A folder's id, found by title under `parentId` or created there.
 *
 * A node with no `url` is a folder, which is the same test the API uses. A
 * bookmark carrying the same title is not a candidate: putting children under
 * it is impossible, and a folder that cannot hold bookmarks would fail every
 * run afterwards.
 */
export async function findOrCreateFolder(
  parentId: string,
  name: string
): Promise<string> {
  const children = await chrome.bookmarks.getChildren(parentId)
  const existing = children.find(
    child => child.url === undefined && child.title === name
  )
  if (existing) return existing.id

  const created = await chrome.bookmarks.create({ parentId, title: name })
  return created.id
}
