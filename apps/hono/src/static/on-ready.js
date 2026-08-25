/**
 * Component initialisation, once per element.
 *
 * A component has to be initialised twice over: for the markup the server
 * sent, and again for whatever HTMX settles into the page afterwards. Each
 * static file used to spell that out, and the ones that forgot the second half
 * were simply dead inside a swapped-in fragment.
 *
 * Usage: onReady('[data-thing="container"]', initThing)
 */
window.onReady = function onReady(selector, init) {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(selector).forEach(init)
  })

  document.addEventListener('htmx:afterSettle', event => {
    const target = event.detail && event.detail.target
    if (!target) return

    if (target.matches && target.matches(selector)) {
      init(target)
    }
    if (target.querySelectorAll) {
      target.querySelectorAll(selector).forEach(init)
    }
  })
}
