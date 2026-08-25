/**
 * Simple dropdown utility
 * Usage: Add data-dropdown="toggle" to button and data-dropdown="menu" to dropdown content
 * They should be siblings within a container with data-dropdown="container"
 *
 * A menu is open exactly when it does not carry the `hidden` class — the same
 * class the server renders it closed with. There is no second copy of that
 * state to keep in step.
 */

/** Every menu currently open. */
function openMenus() {
  return document.querySelectorAll('[data-dropdown="menu"]:not(.hidden)')
}

function closeMenus(except) {
  openMenus().forEach(menu => {
    if (menu !== except) menu.classList.add('hidden')
  })
}

// This file is loaded with `defer`, so the document is already parsed here.
document.addEventListener('click', e => {
  const toggle = e.target.closest('[data-dropdown="toggle"]')

  if (toggle) {
    e.preventDefault()
    const container = toggle.closest('[data-dropdown="container"]')
    if (!container) return

    const menu = container.querySelector('[data-dropdown="menu"]')
    if (!menu) return

    const isOpen = !menu.classList.contains('hidden')

    // Close all other dropdowns first
    closeMenus(menu)

    // Toggle this dropdown
    menu.classList.toggle('hidden', isOpen)
    return
  }

  // Close dropdowns when clicking outside
  if (!e.target.closest('[data-dropdown="container"]')) {
    closeMenus()
  }
})

// Close all dropdowns after HTMX swap (since page doesn't reload)
document.body.addEventListener('htmx:afterSwap', () => {
  closeMenus()
})

// Add loading indicator to #pins-content during HTMX requests
document.body.addEventListener('htmx:beforeRequest', e => {
  const target = e.detail.target
  if (target && target.id === 'pins-content') {
    target.classList.add('is-loading')
  }
})
document.body.addEventListener('htmx:afterRequest', e => {
  const target = e.detail.target
  if (target && target.id === 'pins-content') {
    target.classList.remove('is-loading')
  }
})

// Close on escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeMenus()
  }
})

/**
 * Search toggle for header
 */
onReady('[data-search="toggle"]', searchToggle => {
  const searchForm = document.querySelector('[data-search="form"]')
  const searchInput = document.querySelector('[data-search="input"]')
  const navLinks = document.querySelector('[data-nav="links"]')
  const iconOpen = document.querySelector('[data-search="icon-open"]')
  const iconClose = document.querySelector('[data-search="icon-close"]')

  if (!searchForm) return

  searchToggle.addEventListener('click', () => {
    const isHidden = searchForm.classList.contains('hidden')
    if (isHidden) {
      // Open search
      searchForm.classList.remove('hidden')
      searchForm.classList.add('flex')
      navLinks?.classList.add('hidden')
      iconOpen?.classList.add('hidden')
      iconClose?.classList.remove('hidden')
      searchInput?.focus()
    } else {
      // Close search
      searchForm.classList.add('hidden')
      searchForm.classList.remove('flex')
      navLinks?.classList.remove('hidden')
      iconOpen?.classList.remove('hidden')
      iconClose?.classList.add('hidden')
    }
  })
})
