/**
 * The copy button beside a freshly created API key.
 *
 * Deleted with the rest of the `ps_` key path (PLAN.md Phase 7c).
 */
onReady('[data-copy-api-key]', button => {
  button.addEventListener('click', () => {
    const value = document.getElementById('api-key-value')
    if (!value) return

    void navigator.clipboard.writeText(value.textContent)
    button.textContent = 'Copied!'
    setTimeout(() => {
      button.textContent = 'Copy'
    }, 2000)
  })
})
