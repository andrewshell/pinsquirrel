import { afterEach, describe, expect, it, vi } from 'vitest'
import { findOrCreateFolder } from './bookmark-sync.ts'
import { stubChrome } from './test/chrome-mock.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

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
