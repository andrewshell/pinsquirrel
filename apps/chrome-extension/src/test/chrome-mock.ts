import { vi } from 'vitest'

/**
 * A stand-in for the `chrome` global, for the extension code that talks to it.
 *
 * Only the surface this extension actually uses is here: `storage.local`,
 * `storage.sync` (present so a test can prove nothing writes to it), the two
 * `identity` calls the OAuth flow makes, the `bookmarks` calls the sync makes,
 * and the `runtime` and `alarms` events the service worker listens on.
 * Anything else is left off on purpose - a test that reaches for it should
 * fail loudly rather than get an empty object back.
 *
 * `vi.unstubAllGlobals()` in an `afterEach` is what undoes it.
 */

/** `chrome.identity.launchWebAuthFlow`, in its promise form. */
export type LaunchWebAuthFlowMock = ReturnType<
  typeof vi.fn<
    (details: chrome.identity.WebAuthFlowDetails) => Promise<string | undefined>
  >
>

/** An in-memory `chrome.storage` area, and the record a test can read. */
export interface StubbedStorageArea {
  /** What the area holds right now, readable and writable from a test. */
  items: Record<string, unknown>
}

/** `chrome.runtime.sendMessage`, in its promise form. */
export type SendMessageMock = ReturnType<
  typeof vi.fn<(message: unknown) => Promise<unknown>>
>

/**
 * A `chrome.events.Event`, as a test drives it.
 *
 * The real thing hands a listener to the browser and waits for the browser to
 * call it, which is exactly what a test cannot wait for. This keeps the
 * listeners the code registered and lets the test be the browser.
 */
export interface EventStub<Args extends unknown[], R = void> {
  /** Every listener registered through `addListener`, in order. */
  listeners: ((...args: Args) => R)[]
  /** Call each listener with these arguments; answers what each returned. */
  fire(...args: Args): R[]
}

/** The `chrome.runtime` events the service worker wakes on. */
export interface RuntimeEventsStub {
  onStartup: EventStub<[]>
  onInstalled: EventStub<[chrome.runtime.InstalledDetails]>
  /**
   * A listener answers `true` to say it will call `sendResponse` later, which
   * is what `fire` hands back - the whole point of the return value.
   */
  onMessage: EventStub<
    [unknown, chrome.runtime.MessageSender, (response?: unknown) => void],
    boolean | undefined
  >
}

/** An in-memory `chrome.alarms`: what exists, and what asked for it. */
export interface AlarmsStub {
  /** Every `chrome.alarms.create` call, in order. */
  created: { name: string; info: chrome.alarms.AlarmCreateInfo }[]
  /**
   * The alarms that exist right now, by name. `create` adds one, and a test
   * seeds one to stand for an alarm that survived the worker being unloaded.
   */
  existing: Map<string, chrome.alarms.Alarm>
  onAlarm: EventStub<[chrome.alarms.Alarm]>
}

export interface ChromeStub {
  local: StubbedStorageArea
  sync: StubbedStorageArea
  /** Resolves to the redirect URL Chrome would land on. Set per flow. */
  launchWebAuthFlow: LaunchWebAuthFlowMock
  getRedirectURL: ReturnType<typeof vi.fn<() => string>>
  /** What the service worker answers the popup with. Set per test. */
  sendMessage: SendMessageMock
  /** The bookmark tree the sync reads and writes. */
  bookmarks: BookmarksStub
  /** The events the service worker registers on, for a test to fire. */
  runtime: RuntimeEventsStub
  /** The periodic sync alarm, for a test to inspect and fire. */
  alarms: AlarmsStub
}

/** One event stub, plus the `addListener` the extension code calls. */
function eventStub<Args extends unknown[], R = void>(): EventStub<Args, R> & {
  addListener(listener: (...args: Args) => R): void
} {
  const listeners: ((...args: Args) => R)[] = []
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener)
    },
    fire: (...args) => listeners.map(listener => listener(...args)),
  }
}

/** The callback-free half of `chrome.storage.StorageArea`, backed by an object. */
function storageArea(area: StubbedStorageArea) {
  return {
    get: (keys?: string | string[] | null) => {
      if (keys === undefined || keys === null) {
        return Promise.resolve({ ...area.items })
      }
      const wanted = typeof keys === 'string' ? [keys] : keys
      const found: Record<string, unknown> = {}
      for (const key of wanted) {
        if (key in area.items) found[key] = area.items[key]
      }
      return Promise.resolve(found)
    },
    set: (items: Record<string, unknown>) => {
      Object.assign(area.items, items)
      return Promise.resolve()
    },
    remove: (keys: string | string[]) => {
      for (const key of typeof keys === 'string' ? [keys] : keys) {
        delete area.items[key]
      }
      return Promise.resolve()
    },
    clear: () => {
      for (const key of Object.keys(area.items)) delete area.items[key]
      return Promise.resolve()
    },
  }
}

/**
 * One node of the fake bookmark tree. A node with no `url` is a folder, which
 * is the same rule the real API uses.
 */
interface StubBookmarkNode {
  id: string
  parentId?: string
  title: string
  url?: string
  folderType?: `${chrome.bookmarks.FolderType}`
  /** Child ids, in display order. Folders only. */
  children?: string[]
}

/** The fake bookmark tree, and the handles a test drives it with. */
export interface BookmarksStub {
  /** The bookmarks bar, as Chrome numbers it. The sync has to find this. */
  barId: string
  /** Add a folder and answer its id. */
  addFolder(parentId: string, title: string): string
  /** Add a bookmark and answer its id. */
  addBookmark(parentId: string, title: string, url: string): string
  /** What a folder holds right now, in order. */
  childrenOf(parentId: string): { id: string; title: string; url?: string }[]
  /** Whether a node is still in the tree, for asserting a removal happened. */
  has(id: string): boolean
  /**
   * Every `chrome.bookmarks` call made, in order, spelled `create(1)` or
   * `getChildren(3)`. A test asserts on this to pin down how much of the
   * bookmark API a sync touches, since the cost of this sync is round trips.
   */
  calls: string[]
}

/** The bookmarks bar's id in Chrome, seeded so the tree looks like a real one. */
const BAR_ID = '1'

/**
 * An in-memory `chrome.bookmarks`.
 *
 * Only the calls the sync makes are implemented - `getTree`, `getChildren`,
 * `create`, `update`, `move`, `remove`, `removeTree` - and each throws on an
 * unknown id the way the real API rejects.
 *
 * `move` follows Chromium: the node is taken out of its parent and put back at
 * the requested index, and a same-parent move to a *later* index is adjusted
 * down by one because the index is read in the coordinate space before the
 * removal. The sync only ever moves to an earlier index, where the two spaces
 * agree, so it never depends on that adjustment.
 */
function bookmarksApi(stub: BookmarksStub) {
  const nodes = new Map<string, StubBookmarkNode>([
    ['0', { id: '0', title: '', children: [BAR_ID, '2'] }],
    [
      BAR_ID,
      {
        id: BAR_ID,
        parentId: '0',
        title: 'Bookmarks bar',
        folderType: 'bookmarks-bar',
        children: [],
      },
    ],
    [
      '2',
      {
        id: '2',
        parentId: '0',
        title: 'Other bookmarks',
        folderType: 'other',
        children: [],
      },
    ],
  ])
  let nextId = 3

  const node = (id: string): StubBookmarkNode => {
    const found = nodes.get(id)
    if (!found) throw new Error(`Can't find bookmark for id: ${id}`)
    return found
  }

  const childrenOf = (id: string): string[] => {
    const folder = node(id)
    if (!folder.children) throw new Error(`Bookmark ${id} is not a folder`)
    return folder.children
  }

  const detach = (id: string): void => {
    const parentId = node(id).parentId
    if (parentId === undefined) return
    const siblings = childrenOf(parentId)
    siblings.splice(siblings.indexOf(id), 1)
  }

  const insert = (parentId: string, id: string, index?: number): void => {
    const siblings = childrenOf(parentId)
    siblings.splice(index ?? siblings.length, 0, id)
    node(id).parentId = parentId
  }

  const add = (
    parentId: string,
    title: string,
    url?: string,
    index?: number
  ): StubBookmarkNode => {
    const id = String(nextId++)
    nodes.set(id, { id, parentId, title, url, children: url ? undefined : [] })
    insert(parentId, id, index)
    return node(id)
  }

  /** The API's own view of a node: children nested, index filled in. */
  const view = (
    id: string,
    deep: boolean
  ): chrome.bookmarks.BookmarkTreeNode => {
    const own = node(id)
    const parentId = own.parentId
    return {
      id: own.id,
      ...(parentId === undefined
        ? {}
        : { parentId, index: childrenOf(parentId).indexOf(id) }),
      title: own.title,
      ...(own.url === undefined ? {} : { url: own.url }),
      ...(own.folderType === undefined ? {} : { folderType: own.folderType }),
      syncing: false,
      ...(own.children && deep
        ? { children: own.children.map(child => view(child, true)) }
        : {}),
    }
  }

  const record = (call: string) => stub.calls.push(call)

  stub.addFolder = (parentId, title) => add(parentId, title).id
  stub.addBookmark = (parentId, title, url) => add(parentId, title, url).id
  stub.childrenOf = parentId =>
    childrenOf(parentId).map(id => {
      const own = node(id)
      return {
        id: own.id,
        title: own.title,
        ...(own.url ? { url: own.url } : {}),
      }
    })
  stub.has = id => nodes.has(id)

  return {
    getTree: () => {
      record('getTree()')
      return Promise.resolve([view('0', true)])
    },
    getChildren: (id: string) => {
      record(`getChildren(${id})`)
      return Promise.resolve(childrenOf(id).map(child => view(child, false)))
    },
    create: (details: chrome.bookmarks.CreateDetails) => {
      record(`create(${details.parentId ?? '2'})`)
      const created = add(
        details.parentId ?? '2',
        details.title ?? '',
        details.url,
        details.index
      )
      return Promise.resolve(view(created.id, false))
    },
    update: (id: string, changes: chrome.bookmarks.UpdateChanges) => {
      record(`update(${id})`)
      const own = node(id)
      if (changes.title !== undefined) own.title = changes.title
      if (changes.url !== undefined) own.url = changes.url
      return Promise.resolve(view(id, false))
    },
    move: (id: string, destination: chrome.bookmarks.MoveDestination) => {
      record(`move(${id})`)
      const own = node(id)
      const parentId = destination.parentId ?? own.parentId
      if (parentId === undefined) throw new Error(`Can't move the root`)
      const samePlace = parentId === own.parentId
      const from = samePlace ? childrenOf(parentId).indexOf(id) : -1
      const index =
        destination.index !== undefined && samePlace && destination.index > from
          ? destination.index - 1
          : destination.index
      detach(id)
      insert(parentId, id, index)
      return Promise.resolve(view(id, false))
    },
    remove: (id: string) => {
      record(`remove(${id})`)
      const own = node(id)
      if (own.children?.length) {
        throw new Error(`Can't remove non-empty folder ${id}`)
      }
      detach(id)
      nodes.delete(id)
      return Promise.resolve()
    },
    removeTree: (id: string) => {
      record(`removeTree(${id})`)
      const drop = (target: string) => {
        for (const child of [...(node(target).children ?? [])]) drop(child)
        nodes.delete(target)
      }
      detach(id)
      drop(id)
      return Promise.resolve()
    },
  }
}

/**
 * The extension's own callback URL, as Chrome mints it. Tests that assert a
 * `redirect_uri` compare against this.
 */
export const STUB_REDIRECT_URL = 'https://extensionid.chromiumapp.org/'

/** Install the stub on `globalThis.chrome` and hand back its innards. */
export function stubChrome(
  initialLocal: Record<string, unknown> = {}
): ChromeStub {
  const unimplemented = () => {
    throw new Error('stubChrome has not been installed')
  }

  const runtimeEvents = {
    onStartup: eventStub<[]>(),
    onInstalled: eventStub<[chrome.runtime.InstalledDetails]>(),
    onMessage: eventStub<
      [unknown, chrome.runtime.MessageSender, (response?: unknown) => void],
      boolean | undefined
    >(),
  }

  const onAlarm = eventStub<[chrome.alarms.Alarm]>()
  const alarms: AlarmsStub = { created: [], existing: new Map(), onAlarm }

  const stub: ChromeStub = {
    local: { items: { ...initialLocal } },
    sync: { items: {} },
    launchWebAuthFlow:
      vi.fn<
        (
          details: chrome.identity.WebAuthFlowDetails
        ) => Promise<string | undefined>
      >(),
    getRedirectURL: vi.fn<() => string>(() => STUB_REDIRECT_URL),
    sendMessage: vi.fn<(message: unknown) => Promise<unknown>>(),
    // `bookmarksApi` fills these in over the tree it closes over.
    bookmarks: {
      barId: BAR_ID,
      addFolder: unimplemented,
      addBookmark: unimplemented,
      childrenOf: unimplemented,
      has: unimplemented,
      calls: [],
    },
    runtime: runtimeEvents,
    alarms,
  }

  vi.stubGlobal('chrome', {
    storage: {
      local: storageArea(stub.local),
      sync: storageArea(stub.sync),
    },
    identity: {
      launchWebAuthFlow: stub.launchWebAuthFlow,
      getRedirectURL: stub.getRedirectURL,
    },
    runtime: {
      sendMessage: stub.sendMessage,
      onStartup: runtimeEvents.onStartup,
      onInstalled: runtimeEvents.onInstalled,
      onMessage: runtimeEvents.onMessage,
    },
    alarms: {
      create: (name: string, info: chrome.alarms.AlarmCreateInfo) => {
        alarms.created.push({ name, info })
        alarms.existing.set(name, {
          name,
          scheduledTime: Date.now(),
          ...(info.periodInMinutes === undefined
            ? {}
            : { periodInMinutes: info.periodInMinutes }),
        })
        return Promise.resolve()
      },
      get: (name: string) => Promise.resolve(alarms.existing.get(name)),
      onAlarm,
    },
    bookmarks: bookmarksApi(stub.bookmarks),
  })

  return stub
}
