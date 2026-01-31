/**
 * Vanilla JS Tag Input Component
 *
 * Usage: Add data-tag-input="container" to wrapper div
 * Include data-initial-tags='["tag1", "tag2"]' and data-all-tags='["all", "tags"]'
 */
document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelectorAll('[data-tag-input="container"]')
    .forEach(initTagInput)
})

function initTagInput(container) {
  const initialTags = JSON.parse(container.dataset.initialTags || '[]')
  const allTags = JSON.parse(container.dataset.allTags || '[]')

  let tags = [...initialTags]
  let selectedIndex = -1

  const pillsContainer = container.querySelector('[data-tag-input="pills"]')
  const input = container.querySelector('[data-tag-input="input"]')
  const hiddenInput = container.querySelector('[data-tag-input="hidden"]')
  const suggestions = container.querySelector('[data-tag-input="suggestions"]')

  if (!input || !hiddenInput) return

  // Render initial tags
  renderTags()

  function renderTags() {
    // Clear existing pills (but keep input)
    const existingPills = pillsContainer.querySelectorAll('[data-tag-pill]')
    existingPills.forEach((pill) => pill.remove())

    // Add pills before input
    tags.forEach((tag) => {
      const pill = document.createElement('span')
      pill.className =
        'inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-accent/10 text-accent border border-accent/30'
      pill.dataset.tagPill = tag
      pill.innerHTML = `
        <span>${escapeHtml(tag)}</span>
        <button type="button" class="text-accent/60 hover:text-accent focus:outline-none" data-remove-tag="${escapeHtml(tag)}" aria-label="Remove tag">×</button>
      `
      pillsContainer.insertBefore(pill, input)
    })

    // Update hidden input
    hiddenInput.value = tags.join(',')
  }

  function getFilteredSuggestions() {
    const searchTerm = input.value.toLowerCase().trim()
    if (!searchTerm) return []
    return allTags
      .filter((t) => t.toLowerCase().includes(searchTerm) && !tags.includes(t))
      .slice(0, 10)
  }

  function renderSuggestions() {
    const filtered = getFilteredSuggestions()

    if (filtered.length === 0) {
      suggestions.classList.add('hidden')
      return
    }

    suggestions.innerHTML = filtered
      .map(
        (suggestion, index) => `
      <li class="px-3 py-2 text-sm cursor-pointer hover:bg-accent/10 ${index === selectedIndex ? 'bg-accent/10' : ''}"
          data-suggestion="${escapeHtml(suggestion)}">
        ${escapeHtml(suggestion)}
      </li>
    `
      )
      .join('')

    suggestions.classList.remove('hidden')
  }

  function addTag(tag) {
    const tagToAdd = (tag || input.value).trim().toLowerCase()
    if (tagToAdd && !tags.includes(tagToAdd)) {
      tags.push(tagToAdd)
      renderTags()
    }
    input.value = ''
    selectedIndex = -1
    suggestions.classList.add('hidden')
    input.focus()
  }

  function removeTag(tag) {
    tags = tags.filter((t) => t !== tag)
    renderTags()
    input.focus()
  }

  // Event listeners
  input.addEventListener('input', () => {
    selectedIndex = -1
    renderSuggestions()
  })

  input.addEventListener('focus', () => {
    if (input.value.trim()) {
      renderSuggestions()
    }
  })

  input.addEventListener('blur', () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      suggestions.classList.add('hidden')
    }, 200)
  })

  input.addEventListener('keydown', (e) => {
    const filtered = getFilteredSuggestions()

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < filtered.length) {
          addTag(filtered[selectedIndex])
        } else if (input.value.trim()) {
          addTag()
        }
        break
      case 'Backspace':
        if (input.value === '' && tags.length > 0) {
          tags.pop()
          renderTags()
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (filtered.length > 0) {
          selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1)
          renderSuggestions()
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (filtered.length > 0) {
          selectedIndex = Math.max(selectedIndex - 1, 0)
          renderSuggestions()
        }
        break
      case 'Escape':
        suggestions.classList.add('hidden')
        selectedIndex = -1
        break
      case ',':
        e.preventDefault()
        if (input.value.trim()) {
          addTag()
        }
        break
    }
  })

  // Click on suggestion
  suggestions.addEventListener('click', (e) => {
    const suggestion = e.target.closest('[data-suggestion]')
    if (suggestion) {
      addTag(suggestion.dataset.suggestion)
    }
  })

  // Click to remove tag
  pillsContainer.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-tag]')
    if (removeBtn) {
      removeTag(removeBtn.dataset.removeTag)
    }
  })
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
