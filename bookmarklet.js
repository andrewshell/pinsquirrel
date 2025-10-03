javascript: (function () {
  const url = location.href
  const title = document.title
  const metaDesc = document.querySelector('meta[name="description"]')
  const pageDescription = metaDesc ? metaDesc.getAttribute('content') : ''

  const selection = window.getSelection().toString()
  let description = ''

  if (selection.trim()) {
    description = selection
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<a[^>]*href=\"([^\"]*)\"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<[^>]*>/g, '')
      .trim()
  } else {
    description = pageDescription
  }

  const params = new URLSearchParams({
    url: url,
    title: title,
    description: description,
  })

  const targetUrl = 'https://pinsquirrel.com/pins/new?' + params.toString()
  window.open(targetUrl, '_blank')
})()
