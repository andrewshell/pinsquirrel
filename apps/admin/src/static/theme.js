/**
 * Dark mode, applied before first paint.
 *
 * The console has no theme toggle and nothing to remember: it follows the OS,
 * so this is a straight mirror of `prefers-color-scheme` onto the `.dark`
 * class the shared tokens hang off.
 *
 * This runs in <head> without `defer` on purpose: the class has to be on
 * <html> before the page renders, or the light theme flashes first.
 */
;(function () {
  const query = window.matchMedia('(prefers-color-scheme: dark)')

  function apply(matches) {
    document.documentElement.classList.toggle('dark', matches)
  }

  apply(query.matches)
  query.addEventListener('change', e => {
    apply(e.matches)
  })
})()
