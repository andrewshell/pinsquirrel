/**
 * The profile page's "Pin to PinSquirrel" bookmarklet.
 *
 * The link's href is a `javascript:` URL whose source embeds the origin this
 * page was served from, so it can only be assembled in the browser. Clicking
 * the link does nothing useful — it is meant to be dragged to the bookmarks
 * bar — so a click explains that instead of navigating.
 */

/** The bookmarklet's own source, as text. Raw so its regexes survive. */
function bookmarkletSource(origin) {
  return String.raw`(function() {
  var url = location.href;
  var title = document.title;
  var metaDesc = document.querySelector('meta[name="description"]');
  var pageDescription = metaDesc ? metaDesc.getAttribute("content") : "";
  var selection = window.getSelection().toString();
  var description = "";
  if (selection.trim()) {
    description = selection
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
      .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
      .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
      .replace(/<[^>]*>/g, "")
      .trim();
  } else {
    description = pageDescription;
  }
  var params = new URLSearchParams({
    url: url,
    title: title,
    description: description
  });
  window.open("${origin}/pins/new?" + params.toString(), "_blank");
})();`
}

onReady('#bookmarklet-link', link => {
  link.setAttribute(
    'href',
    'javascript:' +
      encodeURIComponent(bookmarkletSource(window.location.origin))
  )

  link.addEventListener('click', event => {
    event.preventDefault()
    alert('Drag this link to your bookmarks bar instead of clicking it!')
  })
})
