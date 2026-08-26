/**
 * The one-way mirror from PinSquirrel tags into Chrome bookmark folders.
 *
 * Decision 4: sync runs in one direction only. PinSquirrel is the truth, the
 * bookmark tree is a copy of it, and nothing here writes back over the API -
 * so a bookmark a user deleted by hand comes back on the next run, and an
 * edited title is overwritten.
 */

import { ReauthorizationRequiredError } from './auth.ts'
import * as storage from './storage.ts'
import type { Pin, Tag } from './types.ts'

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

/**
 * The order a tag's bookmarks are kept in: newest pin first.
 *
 * Some order has to be chosen, because Chrome keeps a folder in insertion
 * order and a sync that appended whatever the API happened to return first
 * would leave a folder whose arrangement depends on the history of syncs
 * rather than on the pins. Newest first matches how the site lists pins, and
 * `createdAt` never changes, so a pin does not move when it is edited. Ties -
 * two pins created in the same millisecond - fall back to the URL, so the
 * order is total and two machines syncing the same account agree.
 */
function inSyncOrder(pins: Pin[]): Pin[] {
  return [...pins].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || a.url.localeCompare(b.url)
  )
}

/**
 * One bookmark per URL, keeping the first pin that claims it.
 *
 * A URL can be pinned twice - two pins, same page - and a bookmark folder
 * cannot hold that distinction: the second bookmark would be
 * indistinguishable from the first and would be removed as surplus by the
 * next run anyway. Taking the first in sync order means the survivor is the
 * newest pin, and which one survives does not change between runs.
 */
function oneBookmarkPerUrl(pins: Pin[]): Pin[] {
  const seen = new Set<string>()
  return pins.filter(pin => {
    if (seen.has(pin.url)) return false
    seen.add(pin.url)
    return true
  })
}

/**
 * Make a tag's folder hold exactly the given pins, one bookmark per pin.
 *
 * Anything else in the folder goes, subfolders included. The folder is the
 * extension's to keep in step with a tag (Decision 4), so there is no way to
 * tell a bookmark the user filed there on purpose from one left behind by a
 * pin that has since been deleted - and a sync that kept the strays would
 * grow a folder that only ever accumulates. Anything worth keeping belongs
 * outside the PinSquirrel folder.
 *
 * URLs are compared as strings, exactly as they arrived. Chrome stores what it
 * is given, so a pin's URL and the bookmark made from it are the same bytes;
 * normalizing here would only make a bookmark stop matching the pin it came
 * from.
 */
export async function syncTagFolder(
  folderId: string,
  pins: Pin[]
): Promise<void> {
  const children = await chrome.bookmarks.getChildren(folderId)
  const wanted = oneBookmarkPerUrl(inSyncOrder(pins))
  const wantedUrls = new Set(wanted.map(pin => pin.url))

  // One existing bookmark per wanted URL is kept; everything else - a
  // bookmark whose pin is gone, a second copy of one that stayed, a subfolder
  // - is surplus.
  const kept = new Map<string, chrome.bookmarks.BookmarkTreeNode>()
  const surplus: chrome.bookmarks.BookmarkTreeNode[] = []
  /** The ids the folder holds, in order, as the reconciliation goes on. */
  const order: string[] = []
  for (const child of children) {
    if (
      child.url !== undefined &&
      wantedUrls.has(child.url) &&
      !kept.has(child.url)
    ) {
      kept.set(child.url, child)
      order.push(child.id)
    } else {
      surplus.push(child)
    }
  }

  for (const node of surplus) {
    // `remove` refuses a folder that is not empty, so a subfolder goes as a
    // tree; a bookmark has no children and either call would do.
    if (node.url === undefined) await chrome.bookmarks.removeTree(node.id)
    else await chrome.bookmarks.remove(node.id)
  }

  // Walk the wanted pins in order, putting the right node at each position.
  // Everything before `index` is already correct, so a node found later is
  // always moved *backwards* - which matters, because Chrome reads a
  // same-parent move to a later index in the coordinate space before the node
  // is lifted out, and a backwards move is the case where the two agree.
  for (const [index, pin] of wanted.entries()) {
    const existing = kept.get(pin.url)

    if (!existing) {
      const created = await chrome.bookmarks.create({
        parentId: folderId,
        title: pin.title,
        url: pin.url,
        index,
      })
      order.splice(index, 0, created.id)
      continue
    }

    if (existing.title !== pin.title) {
      await chrome.bookmarks.update(existing.id, { title: pin.title })
    }

    const at = order.indexOf(existing.id)
    if (at !== index) {
      await chrome.bookmarks.move(existing.id, { parentId: folderId, index })
      order.splice(at, 1)
      order.splice(index, 0, existing.id)
    }
  }
}

/**
 * Drop the tag folders under the PinSquirrel root that no longer belong.
 *
 * That is a folder named after a tag the user has deselected or deleted, and
 * a second folder carrying a name that is still active - `findOrCreateFolder`
 * only ever uses the first, so any others are stale copies that would never be
 * updated again.
 *
 * Only folders. The root is a place in the user's own bookmark bar, so a
 * bookmark they filed beside the tag folders is left where it is; inside a tag
 * folder the rule is the opposite, because that folder's whole contents are
 * the extension's to keep in step.
 */
export async function removeOrphanFolders(
  parentFolderId: string,
  activeTagNames: string[]
): Promise<void> {
  const wanted = new Set(activeTagNames)
  const children = await chrome.bookmarks.getChildren(parentFolderId)

  const seen = new Set<string>()
  for (const child of children) {
    if (child.url !== undefined) continue
    if (wanted.has(child.title) && !seen.has(child.title)) {
      seen.add(child.title)
      continue
    }
    await chrome.bookmarks.removeTree(child.id)
  }
}

/** The folder the extension owns, at the top of the bookmarks bar. */
const ROOT_FOLDER_NAME = 'PinSquirrel'

/**
 * The bookmarks bar's id.
 *
 * Found by walking the tree rather than assuming `'1'`: the id is stable in
 * Chrome today, but the bar is identified in the API by its `folderType`, and
 * that is what the sync asks for. The literal stays as the fallback for a
 * build old enough not to report `folderType` (it arrived in Chrome 134).
 */
async function bookmarksBarId(): Promise<string> {
  const [root] = await chrome.bookmarks.getTree()
  const bar = root?.children?.find(node => node.folderType === 'bookmarks-bar')
  return bar?.id ?? '1'
}

/**
 * The part of `PinSquirrelApiClient` the sync uses.
 *
 * Named as its own type so a test can drive `syncAll` with two functions
 * instead of a client with a `fetch` behind it. `runSync` is what builds the
 * real one.
 */
export interface SyncApiClient {
  getTags(): Promise<Tag[]>
  getAllPinsForTag(tagId: string): Promise<Pin[]>
}

/** What the popup shows for a failed run. */
function syncErrorMessage(error: unknown): string {
  // The one failure the user has to act on: the grant is gone, and only a
  // fresh consent brings it back. Saying so beats a message about a token the
  // user never knew existed.
  if (error instanceof ReauthorizationRequiredError) {
    return `PinSquirrel needs to be reconnected: ${error.message}`
  }
  if (error instanceof Error) return error.message
  return 'The sync failed for an unknown reason'
}

/**
 * Mirror the selected tags into the bookmark tree, and report the run.
 *
 * The report is the point of the wrapper: the popup renders `lastSyncAt` and
 * `lastSyncError` straight out of storage and is usually shut while a sync
 * runs, so a failure that was not written down reads as a run that worked. The
 * failure is rethrown as well, because the service worker (5f) has to answer
 * the popup's `SyncRequest` with it when the popup *is* open.
 *
 * `lastSyncAt` is left alone by a failed run: it means "when the bookmarks
 * were last correct", and a failure did not change that.
 */
export async function syncAll(input: {
  apiClient: SyncApiClient
  selectedTagIds: string[]
}): Promise<void> {
  try {
    await mirrorTags(input)
  } catch (error) {
    await storage.set({ lastSyncError: syncErrorMessage(error) })
    throw error
  }

  await storage.set({ lastSyncAt: Date.now() })
  await storage.remove(['lastSyncError'])
}

/** The sync itself: tags to folders, pins to bookmarks. */
async function mirrorTags(input: {
  apiClient: SyncApiClient
  selectedTagIds: string[]
}): Promise<void> {
  const tags = await input.apiClient.getTags()
  const byId = new Map(tags.map(tag => [tag.id, tag]))
  const selected = input.selectedTagIds.flatMap(id => {
    const tag = byId.get(id)
    return tag ? [tag] : []
  })

  const rootId = await findOrCreateFolder(
    await bookmarksBarId(),
    ROOT_FOLDER_NAME
  )

  for (const tag of selected) {
    const folderId = await findOrCreateFolder(rootId, tag.name)
    await syncTagFolder(
      folderId,
      await input.apiClient.getAllPinsForTag(tag.id)
    )
  }

  await removeOrphanFolders(
    rootId,
    selected.map(tag => tag.name)
  )
}
