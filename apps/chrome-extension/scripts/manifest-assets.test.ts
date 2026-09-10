import { describe, it, expect } from 'vitest'
import { staticAssetsToCopy } from './manifest-assets.ts'

describe('staticAssetsToCopy', () => {
  it('lists the popup and every icon the manifest references', () => {
    const assets = staticAssetsToCopy({
      action: { default_popup: 'popup.html' },
      icons: { '16': 'icons/icon16.png', '128': 'icons/icon128.png' },
    })

    expect(assets).toEqual([
      'icons/icon128.png',
      'icons/icon16.png',
      'popup.html',
    ])
  })

  it('deduplicates an icon listed under both icons and action.default_icon', () => {
    const assets = staticAssetsToCopy({
      action: {
        default_popup: 'popup.html',
        default_icon: { '16': 'icons/icon16.png' },
      },
      icons: { '16': 'icons/icon16.png' },
    })

    expect(assets).toEqual(['icons/icon16.png', 'popup.html'])
  })

  it('lists the options page, which the manifest names in its own field', () => {
    const assets = staticAssetsToCopy({
      options_page: 'options.html',
      icons: { '16': 'icons/icon16.png' },
    })

    expect(assets).toEqual(['icons/icon16.png', 'options.html'])
  })

  it('leaves out the service worker, which the bundler emits', () => {
    const assets = staticAssetsToCopy({
      background: { service_worker: 'background.js', type: 'module' },
      icons: { '16': 'icons/icon16.png' },
    })

    expect(assets).toEqual(['icons/icon16.png'])
  })
})
