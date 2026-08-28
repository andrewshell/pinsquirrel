/**
 * In-place editing on the Users table.
 *
 * Usage: each editable user renders as a pair of rows sharing an id —
 * data-user-row on the visible display row, data-user-edit on the hidden edit
 * row — plus data-edit-cancel on the edit row's cancel button and data-confirm
 * on any form that must be confirmed before it posts (the delete). A row is
 * open exactly when its edit row does not carry the `hidden` class the server
 * rendered it closed with, the same single-source-of-state rule dropdown.js
 * uses.
 */

/** Every edit row currently open. */
function openEditRows() {
  return document.querySelectorAll('tr[data-user-edit]:not(.hidden)')
}

/**
 * Close one edit row, resetting its selects to what the server rendered.
 *
 * The reset goes through the row's form so the selects joined to it by their
 * `form` attribute come back too, not just the form element's own children.
 */
function closeEditRow(editRow) {
  const form = document.getElementById('edit-' + editRow.dataset.userEdit)
  if (form) form.reset()
  editRow.classList.add('hidden')
  const display = document.querySelector(
    'tr[data-user-row="' + CSS.escape(editRow.dataset.userEdit) + '"]'
  )
  if (display) display.classList.remove('hidden')
}

function closeAllEditRows() {
  openEditRows().forEach(closeEditRow)
}

// This file is loaded with `defer`, so the document is already parsed here.
document.addEventListener('click', e => {
  const cancel = e.target.closest('[data-edit-cancel]')
  if (cancel) {
    const editRow = cancel.closest('tr[data-user-edit]')
    if (editRow) closeEditRow(editRow)
    return
  }

  const display = e.target.closest('tr[data-user-row]')
  // A click on the delete form is its own action, not a request to edit.
  if (!display || e.target.closest('form')) return

  // One row open at a time: opening a second would leave a half-edited first
  // whose unsaved dropdowns look saved.
  closeAllEditRows()

  const editRow = document.querySelector(
    'tr[data-user-edit="' + CSS.escape(display.dataset.userRow) + '"]'
  )
  if (!editRow) return
  display.classList.add('hidden')
  editRow.classList.remove('hidden')
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllEditRows()
})

// The confirm gate for destructive posts — today, the per-row delete.
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-confirm]')
  if (form && !window.confirm(form.dataset.confirm)) e.preventDefault()
})
