/**
 * Tag Select Dropdown Component
 *
 * Usage: Add data-tag-select="container" to wrapper div
 * Include data-tags='[{id, name, pinCount}]', data-selected='["id1"]', data-multiple="true|false"
 * Optional: data-exclude-source="[name='sourceTagIds']" to exclude IDs from another input
 */
document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelectorAll('[data-tag-select="container"]')
    .forEach(initTagSelect)
})

function initTagSelect(container) {
  const allTags = JSON.parse(container.dataset.tags || '[]')
  let selectedIds = JSON.parse(container.dataset.selected || '[]')
  const isMultiple = container.dataset.multiple === 'true'
  const excludeSourceSelector = container.dataset.excludeSource || ''

  const trigger = container.querySelector('[data-tag-select="trigger"]')
  const dropdown = container.querySelector('[data-tag-select="dropdown"]')
  const display = container.querySelector('[data-tag-select="display"]')
  const searchInput = container.querySelector('[data-tag-select="search"]')
  const list = container.querySelector('[data-tag-select="list"]')
  const emptyState = container.querySelector('[data-tag-select="empty"]')
  const hiddenInput = container.querySelector('[data-tag-select="hidden"]')

  if (!trigger || !dropdown || !hiddenInput) return

  let isOpen = false

  // Get IDs to exclude (from source selector for destination dropdown)
  function getExcludedIds() {
    if (!excludeSourceSelector) return []
    const sourceInput = document.querySelector(excludeSourceSelector)
    if (!sourceInput || !sourceInput.value) return []
    return sourceInput.value.split(',').filter(Boolean)
  }

  // Filter tags based on search and exclusions
  function getFilteredTags() {
    const searchTerm = searchInput?.value?.toLowerCase().trim() || ''
    const excludedIds = getExcludedIds()

    return allTags.filter((tag) => {
      // Exclude IDs from source selection
      if (excludedIds.includes(tag.id)) return false
      // Filter by search term
      if (searchTerm && !tag.name.toLowerCase().includes(searchTerm)) {
        return false
      }
      return true
    })
  }

  // Render the display area (pills or selected text)
  function renderDisplay() {
    const selectedTags = allTags.filter((t) => selectedIds.includes(t.id))

    if (selectedTags.length === 0) {
      display.innerHTML = `<span class="text-muted-foreground" data-tag-select="placeholder">${container.querySelector('[data-tag-select="placeholder"]')?.textContent || 'Select tags...'}</span>`
    } else if (isMultiple) {
      display.innerHTML = selectedTags
        .map(
          (tag) => `
        <span class="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground border-2 border-foreground text-xs"
              data-tag-select="pill" data-tag-id="${escapeHtml(tag.id)}">
          ${escapeHtml(tag.name)}
          <button type="button" class="hover:text-destructive focus:outline-none"
                  data-tag-select="remove" data-tag-id="${escapeHtml(tag.id)}"
                  aria-label="Remove ${escapeHtml(tag.name)}">×</button>
        </span>
      `
        )
        .join('')
    } else {
      display.innerHTML = `<span data-tag-select="selected-text">${escapeHtml(selectedTags[0]?.name || '')}</span>`
    }

    // Update hidden input
    hiddenInput.value = selectedIds.join(',')
  }

  // Render the tag list
  function renderList() {
    const filtered = getFilteredTags()

    if (filtered.length === 0) {
      list.classList.add('hidden')
      emptyState?.classList.remove('hidden')
      return
    }

    list.classList.remove('hidden')
    emptyState?.classList.add('hidden')

    list.innerHTML = filtered
      .map((tag) => {
        const isSelected = selectedIds.includes(tag.id)
        return `
        <button type="button" role="option" aria-selected="${isSelected}"
                class="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 focus:outline-none focus:bg-muted/50 ${isSelected ? 'bg-muted/30' : ''}"
                data-tag-select="option" data-tag-id="${escapeHtml(tag.id)}" data-tag-name="${escapeHtml(tag.name)}">
          <div class="flex items-center justify-center w-4 h-4">
            ${
              isSelected
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-tag-select="check"><path d="M20 6 9 17l-5-5"/></svg>`
                : ''
            }
          </div>
          <span class="flex-1" data-tag-select="option-name">${escapeHtml(tag.name)}</span>
          <span class="text-xs text-muted-foreground" data-tag-select="option-count">${tag.pinCount}</span>
        </button>
      `
      })
      .join('')
  }

  // Toggle dropdown open/closed
  function toggleDropdown(open) {
    isOpen = open
    if (open) {
      dropdown.classList.remove('hidden')
      trigger.setAttribute('aria-expanded', 'true')
      renderList()
      // Focus search input
      setTimeout(() => searchInput?.focus(), 0)
    } else {
      dropdown.classList.add('hidden')
      trigger.setAttribute('aria-expanded', 'false')
      if (searchInput) searchInput.value = ''
    }
  }

  // Handle tag selection
  function selectTag(tagId) {
    if (isMultiple) {
      // Toggle selection
      if (selectedIds.includes(tagId)) {
        selectedIds = selectedIds.filter((id) => id !== tagId)
      } else {
        selectedIds.push(tagId)
      }
      renderDisplay()
      renderList()
    } else {
      // Single select - select and close
      selectedIds = [tagId]
      renderDisplay()
      toggleDropdown(false)
    }

    // Dispatch change event for other components to listen to
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // Remove tag from selection
  function removeTag(tagId) {
    selectedIds = selectedIds.filter((id) => id !== tagId)
    renderDisplay()
    if (isOpen) renderList()
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // Event: Click trigger to toggle
  trigger.addEventListener('click', (e) => {
    // Don't toggle if clicking remove button
    if (e.target.closest('[data-tag-select="remove"]')) return
    toggleDropdown(!isOpen)
  })

  // Event: Click remove button on pill
  display.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-tag-select="remove"]')
    if (removeBtn) {
      e.preventDefault()
      e.stopPropagation()
      removeTag(removeBtn.dataset.tagId)
    }
  })

  // Event: Search input
  searchInput?.addEventListener('input', () => {
    renderList()
  })

  // Event: Click on option
  list.addEventListener('click', (e) => {
    const option = e.target.closest('[data-tag-select="option"]')
    if (option) {
      // Stop propagation to prevent the "click outside" handler from closing
      // the dropdown (the clicked element gets removed during re-render)
      if (isMultiple) {
        e.stopPropagation()
      }
      selectTag(option.dataset.tagId)
    }
  })

  // Event: Keyboard navigation
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      toggleDropdown(false)
      trigger.focus()
    }
  })

  // Event: Click outside to close
  document.addEventListener('click', (e) => {
    if (isOpen && !container.contains(e.target)) {
      toggleDropdown(false)
    }
  })

  // Listen for changes on the source selector to update excluded items
  if (excludeSourceSelector) {
    const sourceInput = document.querySelector(excludeSourceSelector)
    if (sourceInput) {
      sourceInput.addEventListener('change', () => {
        // If current selection is now excluded, clear it
        const excludedIds = getExcludedIds()
        const wasSelected = selectedIds.some((id) => excludedIds.includes(id))
        if (wasSelected) {
          selectedIds = selectedIds.filter((id) => !excludedIds.includes(id))
          renderDisplay()
        }
        if (isOpen) renderList()
      })
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Merge Summary Component
 *
 * Shows a summary of the merge operation when both source and destination are selected
 */
document.addEventListener('DOMContentLoaded', () => {
  initMergeSummary()
})

function initMergeSummary() {
  const summaryEl = document.getElementById('merge-summary')
  const tagCountEl = document.getElementById('merge-summary-tag-count')
  const pinCountEl = document.getElementById('merge-summary-pin-count')
  const tagsDataEl = document.getElementById('tags-data')

  // Only initialize if all elements exist (we're on the merge page)
  if (!summaryEl || !tagCountEl || !pinCountEl || !tagsDataEl) return

  const sourceInput = document.querySelector('[name="sourceTagIds"]')
  const destInput = document.querySelector('[name="destinationTagId"]')

  if (!sourceInput || !destInput) return

  // Parse tags data
  let allTags = []
  try {
    allTags = JSON.parse(tagsDataEl.textContent || '[]')
  } catch (e) {
    console.error('Failed to parse tags data:', e)
    return
  }

  function updateSummary() {
    const sourceIds = sourceInput.value
      ? sourceInput.value.split(',').filter(Boolean)
      : []
    const destId = destInput.value

    // Show summary only when both source and destination are selected
    if (sourceIds.length > 0 && destId) {
      // Calculate total pin count from source tags
      const totalPinCount = sourceIds.reduce((sum, id) => {
        const tag = allTags.find((t) => t.id === id)
        return sum + (tag?.pinCount || 0)
      }, 0)

      tagCountEl.textContent = sourceIds.length
      pinCountEl.textContent = totalPinCount
      summaryEl.classList.remove('hidden')
    } else {
      summaryEl.classList.add('hidden')
    }
  }

  // Listen for changes on both inputs
  sourceInput.addEventListener('change', updateSummary)
  destInput.addEventListener('change', updateSummary)

  // Initial update in case there are pre-selected values
  updateSummary()
}
