;(function () {
  // Only run on private mode pages
  if (!document.documentElement.classList.contains('private-mode')) return

  // Auto-lock on tab close
  window.addEventListener('beforeunload', function () {
    // ?beacon=1 tells the route this is a tab-close lock, which wants a 204
    // instead of the redirect a form post gets.
    navigator.sendBeacon('/private/lock?beacon=1')
  })
})()
