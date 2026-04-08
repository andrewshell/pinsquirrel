;(function () {
  // Only run on private mode pages
  if (!document.documentElement.classList.contains('private-mode')) return

  // Auto-lock on tab close
  window.addEventListener('beforeunload', function () {
    navigator.sendBeacon('/private/lock')
  })
})()
