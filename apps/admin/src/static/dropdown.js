/**
 * Dropdown menus for the console header.
 *
 * Usage: data-dropdown="toggle" on the button, data-dropdown="menu" on the
 * panel, both inside a data-dropdown="container" — the contract the shared
 * ProfileDropdown renders. A menu is open exactly when it does not carry the
 * `hidden` class the server rendered it closed with, so there is no second
 * copy of that state to keep in step.
 *
 * This is the Hono app's dropdown.js with the HTMX and search-toggle halves
 * removed: the console has neither, and nothing here needs to re-initialise
 * after a swap, which is why it also needs no on-ready.js.
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

// Close on escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeMenus()
  }
})
