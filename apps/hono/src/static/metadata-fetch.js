/**
 * Metadata fetch utility for pin forms
 * Usage: Add data-metadata-fetch to form, and data-url-input, data-title-input,
 * data-description-input, data-refresh-button to respective elements
 *
 * Auto-fetch: When URL input loses focus and title is empty, fetches metadata
 * Manual refresh: Click refresh button to re-fetch and overwrite title/description
 */
document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll('[data-metadata-fetch]')

  forms.forEach((form) => {
    const urlInput = form.querySelector('[data-url-input]')
    const titleInput = form.querySelector('[data-title-input]')
    const descriptionInput = form.querySelector('[data-description-input]')
    const refreshButton = form.querySelector('[data-refresh-button]')

    if (!urlInput || !titleInput) return

    let debounceTimer = null
    let isFetching = false

    /**
     * Update the refresh button state
     */
    function updateRefreshButtonState() {
      if (!refreshButton) return

      const hasValidUrl = isValidUrl(urlInput.value)
      refreshButton.disabled = !hasValidUrl || isFetching
    }

    /**
     * Check if a string is a valid URL
     */
    function isValidUrl(string) {
      if (!string || string.trim() === '') return false
      try {
        const url = new URL(string)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    }

    /**
     * Set loading state on the button
     */
    function setLoading(loading) {
      isFetching = loading

      if (!refreshButton) return

      const icon = refreshButton.querySelector('[data-refresh-icon]')
      if (icon) {
        if (loading) {
          icon.classList.add('animate-spin')
        } else {
          icon.classList.remove('animate-spin')
        }
      }

      updateRefreshButtonState()
    }

    /**
     * Fetch metadata from the API
     */
    async function fetchMetadata(url, overwrite = false) {
      if (!isValidUrl(url)) return

      // For auto-fetch, only proceed if title is empty
      if (!overwrite && titleInput.value.trim() !== '') return

      setLoading(true)

      // Show loading placeholder in title field
      const originalTitle = titleInput.value
      if (titleInput.value.trim() === '' || overwrite) {
        titleInput.value = 'Fetching page title...'
        titleInput.disabled = true
      }

      try {
        const response = await fetch(
          `/api/metadata?url=${encodeURIComponent(url)}`
        )
        const data = await response.json()

        if (response.ok) {
          // Set title (always for manual refresh, only if empty for auto)
          if (overwrite || originalTitle.trim() === '') {
            titleInput.value = data.title || ''
          }

          // Set description if available and (overwrite or empty)
          if (descriptionInput) {
            if (overwrite || descriptionInput.value.trim() === '') {
              descriptionInput.value = data.description || ''
            }
          }
        } else {
          // Restore original title on error
          titleInput.value = originalTitle
          console.warn('Metadata fetch error:', data.error)
        }
      } catch (error) {
        // Restore original title on error
        titleInput.value = originalTitle
        console.warn('Metadata fetch failed:', error)
      } finally {
        titleInput.disabled = false
        setLoading(false)
      }
    }

    /**
     * Handle URL input blur event with debouncing
     */
    function handleUrlBlur() {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      debounceTimer = setTimeout(() => {
        const url = urlInput.value.trim()
        if (url && titleInput.value.trim() === '') {
          fetchMetadata(url, false)
        }
      }, 300)
    }

    /**
     * Handle URL input change (for button state)
     */
    function handleUrlChange() {
      updateRefreshButtonState()
    }

    /**
     * Handle refresh button click
     */
    function handleRefreshClick(e) {
      e.preventDefault()
      const url = urlInput.value.trim()
      if (url) {
        fetchMetadata(url, true)
      }
    }

    // Set up event listeners
    urlInput.addEventListener('blur', handleUrlBlur)
    urlInput.addEventListener('input', handleUrlChange)

    if (refreshButton) {
      refreshButton.addEventListener('click', handleRefreshClick)
    }

    // Initialize button state
    updateRefreshButtonState()
  })
})
