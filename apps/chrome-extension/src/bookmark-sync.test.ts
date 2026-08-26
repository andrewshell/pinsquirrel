import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  findOrCreateFolder,
  removeOrphanFolders,
  syncTagFolder,
} from './bookmark-sync.ts'
import { stubChrome } from './test/chrome-mock.ts'
import type { Pin } from './types.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A pin with only the fields the sync reads spelled out per test. */
function pin(fields: Partial<Pin> & Pick<Pin, 'url' | 'title'>): Pin {
  return {
    id: `pin-${fields.url}`,
    userId: 'user-1',
    description: null,
    readLater: false,
    isPrivate: false,
    tagNames: ['reading'],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...fields,
  }
}

describe('findOrCreateFolder', () => {
  it('answers the id of a folder that is already there', async () => {
    const { bookmarks } = stubChrome()
    const existing = bookmarks.addFolder(bookmarks.barId, 'PinSquirrel')

    await expect(
      findOrCreateFolder(bookmarks.barId, 'PinSquirrel')
    ).resolves.toBe(existing)
    expect(bookmarks.calls).toEqual([`getChildren(${bookmarks.barId})`])
  })

  it('creates the folder when the parent has no such child', async () => {
    const { bookmarks } = stubChrome()

    const id = await findOrCreateFolder(bookmarks.barId, 'PinSquirrel')

    expect(bookmarks.childrenOf(bookmarks.barId)).toEqual([
      { id, title: 'PinSquirrel' },
    ])
  })

  it('ignores a bookmark that happens to carry the folder name', async () => {
    const { bookmarks } = stubChrome()
    bookmarks.addBookmark(
      bookmarks.barId,
      'PinSquirrel',
      'https://pinsquirrel.com'
    )

    const id = await findOrCreateFolder(bookmarks.barId, 'PinSquirrel')

    expect(bookmarks.childrenOf(bookmarks.barId)).toEqual([
      {
        id: expect.any(String),
        title: 'PinSquirrel',
        url: 'https://pinsquirrel.com',
      },
      { id, title: 'PinSquirrel' },
    ])
  })
})

describe('syncTagFolder', () => {
  it('adds a bookmark for every pin, newest first', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')

    await syncTagFolder(folder, [
      pin({
        url: 'https://example.com/older',
        title: 'Older',
        createdAt: '2026-07-01T00:00:00.000Z',
      }),
      pin({
        url: 'https://example.com/newer',
        title: 'Newer',
        createdAt: '2026-08-01T00:00:00.000Z',
      }),
    ])

    expect(bookmarks.childrenOf(folder)).toEqual([
      {
        id: expect.any(String),
        title: 'Newer',
        url: 'https://example.com/newer',
      },
      {
        id: expect.any(String),
        title: 'Older',
        url: 'https://example.com/older',
      },
    ])
  })
})

describe('syncTagFolder, against a folder that already holds bookmarks', () => {
  it('keeps a bookmark whose URL is still pinned and leaves its title alone', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')
    const existing = bookmarks.addBookmark(
      folder,
      'An article',
      'https://example.com/article'
    )
    bookmarks.calls.length = 0

    await syncTagFolder(folder, [
      pin({ url: 'https://example.com/article', title: 'An article' }),
    ])

    expect(bookmarks.childrenOf(folder)).toEqual([
      {
        id: existing,
        title: 'An article',
        url: 'https://example.com/article',
      },
    ])
    expect(bookmarks.calls).toEqual([`getChildren(${folder})`])
  })

  it('renames a bookmark whose pin title changed', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')
    const existing = bookmarks.addBookmark(
      folder,
      'Old title',
      'https://example.com/article'
    )

    await syncTagFolder(folder, [
      pin({ url: 'https://example.com/article', title: 'New title' }),
    ])

    expect(bookmarks.childrenOf(folder)).toEqual([
      { id: existing, title: 'New title', url: 'https://example.com/article' },
    ])
  })
})

describe('syncTagFolder, clearing out what the pins no longer name', () => {
  it('removes a bookmark whose pin is gone', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')
    const stale = bookmarks.addBookmark(
      folder,
      'Unpinned',
      'https://example.com/gone'
    )

    await syncTagFolder(folder, [
      pin({ url: 'https://example.com/kept', title: 'Kept' }),
    ])

    expect(bookmarks.has(stale)).toBe(false)
    expect(bookmarks.childrenOf(folder)).toEqual([
      {
        id: expect.any(String),
        title: 'Kept',
        url: 'https://example.com/kept',
      },
    ])
  })

  it('removes a subfolder someone put inside a tag folder, contents and all', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')
    const subfolder = bookmarks.addFolder(folder, 'Notes')
    bookmarks.addBookmark(subfolder, 'A note', 'https://example.com/note')

    await syncTagFolder(folder, [])

    expect(bookmarks.has(subfolder)).toBe(false)
    expect(bookmarks.childrenOf(folder)).toEqual([])
  })

  it('keeps one bookmark per URL when the same URL is pinned twice', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')

    await syncTagFolder(folder, [
      pin({ url: 'https://example.com/article', title: 'An article' }),
      pin({
        url: 'https://example.com/article',
        title: 'The same article',
        id: 'pin-duplicate',
        createdAt: '2026-07-01T00:00:00.000Z',
      }),
    ])

    expect(bookmarks.childrenOf(folder)).toEqual([
      {
        id: expect.any(String),
        title: 'An article',
        url: 'https://example.com/article',
      },
    ])
  })

  it('collapses two bookmarks that already carry the same URL into one', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')
    const first = bookmarks.addBookmark(
      folder,
      'An article',
      'https://example.com/article'
    )
    const second = bookmarks.addBookmark(
      folder,
      'An article',
      'https://example.com/article'
    )

    await syncTagFolder(folder, [
      pin({ url: 'https://example.com/article', title: 'An article' }),
    ])

    expect(bookmarks.has(second)).toBe(false)
    expect(bookmarks.childrenOf(folder)).toEqual([
      { id: first, title: 'An article', url: 'https://example.com/article' },
    ])
  })
})

describe('syncTagFolder, ordering', () => {
  const older = pin({
    url: 'https://example.com/older',
    title: 'Older',
    createdAt: '2026-07-01T00:00:00.000Z',
  })
  const newer = pin({
    url: 'https://example.com/newer',
    title: 'Newer',
    createdAt: '2026-08-01T00:00:00.000Z',
  })

  it('moves a bookmark that sits ahead of a newer pin', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')
    const olderId = bookmarks.addBookmark(folder, 'Older', older.url)
    const newerId = bookmarks.addBookmark(folder, 'Newer', newer.url)
    bookmarks.calls.length = 0

    await syncTagFolder(folder, [older, newer])

    expect(bookmarks.childrenOf(folder).map(child => child.id)).toEqual([
      newerId,
      olderId,
    ])
    expect(bookmarks.calls).toEqual([
      `getChildren(${folder})`,
      `move(${newerId})`,
    ])
  })

  it('touches nothing when the folder already matches the pins', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')
    bookmarks.addBookmark(folder, 'Newer', newer.url)
    bookmarks.addBookmark(folder, 'Older', older.url)
    bookmarks.calls.length = 0

    await syncTagFolder(folder, [older, newer])

    expect(bookmarks.calls).toEqual([`getChildren(${folder})`])
  })

  it('files a new bookmark in its place rather than at the end', async () => {
    const { bookmarks } = stubChrome()
    const folder = bookmarks.addFolder(bookmarks.barId, 'reading')
    const olderId = bookmarks.addBookmark(folder, 'Older', older.url)

    await syncTagFolder(folder, [older, newer])

    expect(bookmarks.childrenOf(folder)).toEqual([
      { id: expect.any(String), title: 'Newer', url: newer.url },
      { id: olderId, title: 'Older', url: older.url },
    ])
  })
})

describe('removeOrphanFolders', () => {
  it('removes a folder no selected tag is named after, contents and all', async () => {
    const { bookmarks } = stubChrome()
    const root = bookmarks.addFolder(bookmarks.barId, 'PinSquirrel')
    const kept = bookmarks.addFolder(root, 'reading')
    const orphan = bookmarks.addFolder(root, 'deselected')
    bookmarks.addBookmark(orphan, 'A page', 'https://example.com/page')

    await removeOrphanFolders(root, ['reading'])

    expect(bookmarks.has(orphan)).toBe(false)
    expect(bookmarks.childrenOf(root)).toEqual([{ id: kept, title: 'reading' }])
  })

  it('removes a second folder carrying an active tag name', async () => {
    const { bookmarks } = stubChrome()
    const root = bookmarks.addFolder(bookmarks.barId, 'PinSquirrel')
    const first = bookmarks.addFolder(root, 'reading')
    const duplicate = bookmarks.addFolder(root, 'reading')

    await removeOrphanFolders(root, ['reading'])

    expect(bookmarks.has(duplicate)).toBe(false)
    expect(bookmarks.childrenOf(root)).toEqual([
      { id: first, title: 'reading' },
    ])
  })

  it('leaves a bookmark filed next to the tag folders alone', async () => {
    const { bookmarks } = stubChrome()
    const root = bookmarks.addFolder(bookmarks.barId, 'PinSquirrel')
    const loose = bookmarks.addBookmark(
      root,
      'PinSquirrel',
      'https://pinsquirrel.com'
    )

    await removeOrphanFolders(root, ['reading'])

    expect(bookmarks.has(loose)).toBe(true)
  })
})
