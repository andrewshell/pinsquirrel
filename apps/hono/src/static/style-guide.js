/**
 * The style guide's dark-mode toggle, which exists so accessibility scans can
 * run against both themes. theme.js has already applied the stored choice by
 * the time this runs, so the label only has to be synced to it.
 */
onReady('[data-dark-toggle]', button => {
  const label = document.getElementById('style-dark-label')

  function setLabel(isDark) {
    if (!label) return
    label.textContent = isDark ? 'Switch to light mode' : 'Switch to dark mode'
  }

  setLabel(document.documentElement.classList.contains('dark'))

  button.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
    setLabel(isDark)
  })
})
