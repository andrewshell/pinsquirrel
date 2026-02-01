/**
 * Simple dropdown utility
 * Usage: Add data-dropdown="toggle" to button and data-dropdown="menu" to dropdown content
 * They should be siblings within a container with data-dropdown="container"
 */
document.addEventListener('DOMContentLoaded', () => {
  // Handle dropdown toggles
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-dropdown="toggle"]')

    if (toggle) {
      e.preventDefault()
      const container = toggle.closest('[data-dropdown="container"]')
      if (!container) return

      const menu = container.querySelector('[data-dropdown="menu"]')
      if (!menu) return

      const isOpen = menu.dataset.open === 'true'

      // Close all other dropdowns first
      document
        .querySelectorAll('[data-dropdown="menu"][data-open="true"]')
        .forEach((m) => {
          if (m !== menu) {
            m.dataset.open = 'false'
            m.classList.add('hidden')
          }
        })

      // Toggle this dropdown
      if (isOpen) {
        menu.dataset.open = 'false'
        menu.classList.add('hidden')
      } else {
        menu.dataset.open = 'true'
        menu.classList.remove('hidden')
      }
      return
    }

    // Close dropdowns when clicking outside
    const clickedInDropdown = e.target.closest('[data-dropdown="container"]')
    if (!clickedInDropdown) {
      document
        .querySelectorAll('[data-dropdown="menu"][data-open="true"]')
        .forEach((menu) => {
          menu.dataset.open = 'false'
          menu.classList.add('hidden')
        })
    }
  })

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document
        .querySelectorAll('[data-dropdown="menu"][data-open="true"]')
        .forEach((menu) => {
          menu.dataset.open = 'false'
          menu.classList.add('hidden')
        })
    }
  })
})

/**
 * Search toggle for header
 */
document.addEventListener('DOMContentLoaded', () => {
  const searchToggle = document.querySelector('[data-search="toggle"]')
  const searchForm = document.querySelector('[data-search="form"]')
  const searchInput = document.querySelector('[data-search="input"]')
  const navLinks = document.querySelector('[data-nav="links"]')
  const iconOpen = document.querySelector('[data-search="icon-open"]')
  const iconClose = document.querySelector('[data-search="icon-close"]')

  if (searchToggle && searchForm) {
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
  }
})
