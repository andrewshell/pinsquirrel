import { secureHeaders } from 'hono/secure-headers'

/**
 * The app's security headers, including its Content-Security-Policy.
 *
 * `script-src 'self'` is the point of the policy: no inline `<script>`, no
 * `onclick=`, no `javascript:` URL runs. Every behaviour lives in
 * `src/static/*.js` instead, and anything new has to as well — one inline
 * script anywhere would force the whole app to relax this.
 *
 * HTMX needs nothing beyond it. It evaluates no strings unless `hx-on` or
 * `htmx.config.allowEval` are used, and this app uses neither. Styles are
 * deliberately left unrestricted: Tailwind ships a stylesheet, but HTMX and
 * the components set inline `style` on elements, which `style-src` would
 * block without buying anything here.
 */
export function securityHeaders() {
  return secureHeaders({
    contentSecurityPolicy: {
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  })
}
