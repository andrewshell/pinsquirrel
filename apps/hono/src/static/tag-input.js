/**
 * Alpine.js Tag Input Component
 *
 * Usage:
 * <div x-data="tagInput({ tags: ['existing', 'tags'], allTags: ['all', 'available', 'tags'] })">
 *   ...
 * </div>
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('tagInput', (config = {}) => ({
    tags: config.tags || [],
    input: '',
    allTags: config.allTags || [],
    selectedIndex: -1,
    showSuggestions: false,
    inputId: config.inputId || 'tag-input',

    init() {
      // Close suggestions when clicking outside
      this.$watch('input', () => {
        this.selectedIndex = -1
        this.showSuggestions =
          this.input.length > 0 && this.filteredSuggestions.length > 0
      })
    },

    get filteredSuggestions() {
      if (!this.input.trim()) return []
      const searchTerm = this.input.toLowerCase().trim()
      return this.allTags
        .filter(
          (t) => t.toLowerCase().includes(searchTerm) && !this.tags.includes(t)
        )
        .slice(0, 10)
    },

    addTag(tag = null) {
      const tagToAdd = (tag || this.input).trim().toLowerCase()
      if (tagToAdd && !this.tags.includes(tagToAdd)) {
        this.tags.push(tagToAdd)
      }
      this.input = ''
      this.showSuggestions = false
      this.selectedIndex = -1
      // Focus back on input
      this.$nextTick(() => {
        this.$refs.tagInput?.focus()
      })
    },

    removeTag(tag) {
      this.tags = this.tags.filter((t) => t !== tag)
      this.$nextTick(() => {
        this.$refs.tagInput?.focus()
      })
    },

    handleBackspace() {
      if (this.input === '' && this.tags.length > 0) {
        this.tags.pop()
      }
    },

    handleKeydown(event) {
      switch (event.key) {
        case 'Enter':
          event.preventDefault()
          if (
            this.selectedIndex >= 0 &&
            this.selectedIndex < this.filteredSuggestions.length
          ) {
            this.addTag(this.filteredSuggestions[this.selectedIndex])
          } else if (this.input.trim()) {
            this.addTag()
          }
          break
        case 'Backspace':
          this.handleBackspace()
          break
        case 'ArrowDown':
          event.preventDefault()
          if (this.filteredSuggestions.length > 0) {
            this.showSuggestions = true
            this.selectedIndex = Math.min(
              this.selectedIndex + 1,
              this.filteredSuggestions.length - 1
            )
          }
          break
        case 'ArrowUp':
          event.preventDefault()
          if (this.filteredSuggestions.length > 0) {
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0)
          }
          break
        case 'Escape':
          this.showSuggestions = false
          this.selectedIndex = -1
          break
        case ',':
          event.preventDefault()
          if (this.input.trim()) {
            this.addTag()
          }
          break
      }
    },

    selectSuggestion(suggestion) {
      this.addTag(suggestion)
    },

    get tagsValue() {
      return this.tags.join(',')
    },
  }))
})
