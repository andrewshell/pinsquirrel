/**
 * The 500 page's "Try Again" button, which reloads the page.
 */
onReady('[data-reload-button]', button => {
  button.addEventListener('click', () => {
    window.location.reload()
  })
})
