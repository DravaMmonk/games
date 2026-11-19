// A name edited where it is shown (a chapter's title in the chapter list and over its board, the game's over its page): the field looks like the
// text it stands for; Enter or leaving it writes the name, Escape puts back the one shown. An empty name is not written.
// Opened for renaming (`autoFocus`), it starts with the whole name selected.
// The field follows the name it is given, so it shows the written name once the preview comes back.
import { useEffect, useRef, useState } from 'react'

export default function TitleEdit({ value, label, disabled = false, autoFocus = false, className = '', onSet, onDone = () => {} }) {
  const [text, setText] = useState(value)
  const [shown, setShown] = useState(value)
  const cancelled = useRef(false)
  const editing = useRef(false)
  if (shown !== value) { setShown(value); setText(value) }
  // Taken away while it is being edited, it writes what it holds (TextField.jsx does the same).
  const unmounting = useRef(null)
  unmounting.current = () => { const next = text.trim(); if (editing.current && next && next !== value) onSet(next) }
  useEffect(() => () => unmounting.current(), [])
  const finish = () => {
    const next = text.trim()
    if (cancelled.current || !next) setText(value)
    else if (next !== value) onSet(next)
    cancelled.current = false
    editing.current = false
    onDone()
  }
  return (
    <input className={`title-edit ${className}`} value={text} aria-label={label} title={label} disabled={disabled} autoFocus={autoFocus} spellCheck={false}
      onChange={(event) => setText(event.target.value)} onBlur={finish} onFocus={(event) => { editing.current = true; if (autoFocus) event.currentTarget.select() }} onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') { event.stopPropagation(); cancelled.current = true; event.currentTarget.blur() }
      }} />
  )
}
