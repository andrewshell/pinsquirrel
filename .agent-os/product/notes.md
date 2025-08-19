Pins are at the core a title with one or more of the following attached:

URL - this allows the pin to be viewed as a link
markdown - this allows the pin to be viewed as a note - so markdown might be the representation of what's linked (read it later app) - but it can also be a standalone note
images - one or more images might be attached to the pin and viewed as thumbnails (like pinterest) - images will be accessable to the markdown for inline images - can be an image like on pinterest that's a representative of the URL content - might just be an uploaded image for a gallary of photos
tags - ways to group pins
read_later - boolean for read it later functionlity

/:username/pins # All pins with URLs - click title → visit URL
/:username/notes # All pins with markdown - click title → view markdown
/:username/images # All pins with images - click image → view full size
/:username/tags # Tag cloud of existing tags

These are just views of pins, each can be filtered by tag or unread status

So an example could be /pins?tag=article&unread=true

/:username/pins/new
/:username/pins/:id/edit
/:username/pins/:id/delete

These are the code crud endpoints

/:username/pins/new can get query params to pre-populate from bookmarklet or browser extension

There will also be unique CRUD forms for notes and images.

Notes will just be a title, markdown editor (with image attach/embed) and tags
Images will jus tbe title, bulk image uploader and tags
