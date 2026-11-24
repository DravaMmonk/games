import { tr } from '../shell/i18n.js'
import { usePointerSession } from '../views/usePointerSession.js'

const SIZE = { tree: [180, 640], audit: [90, 900], side: [260, 900] }

/** Move the separator without reflowing the workspace until the drag is committed. */
export default function PanelResizer({ side, size, open, setLayout }) {
  const { track } = usePointerSession()
  const set = (patch) => setLayout((layout) => ({ ...layout, ...patch }))
  const across = side !== 'audit'
  const sign = side === 'tree' ? 1 : -1
  const [min, max] = SIZE[side]
  const clamp = (value) => Math.max(min, Math.min(max, value))
  const position = (event) => across ? event.clientX : event.clientY
  const toggle = (event) => {
    if (!event.currentTarget.parentElement.dataset.resizing) set({ [`${side}Open`]: !open })
  }
  const drag = (event) => {
    const handle = event.currentTarget
    const body = handle.parentElement
    if (!open || body.dataset.resizing || event.button !== 0 || !event.isPrimary) return
    event.preventDefault()
    handle.focus({ preventScroll: true })
    const start = position(event)
    const limit = across ? max : Math.floor(window.innerHeight * 0.7)
    const initial = Math.min(size, limit)
    const sizeAt = (next) => Math.min(limit, clamp(initial + sign * (position(next) - start)))
    let pending = initial
    let painted = initial
    let frame = null
    body.dataset.resizing = side
    handle.dataset.dragging = ''
    track(event, {
      capture: true,
      escape: true,
      move(next) {
        pending = sizeAt(next)
        if (frame !== null || pending === painted) return
        frame = requestAnimationFrame(() => {
          frame = null
          const offset = sign * (pending - initial)
          handle.style.transform = across ? `translateX(${offset}px)` : `translateY(${offset}px)`
          painted = pending
        })
      },
      finish(commit, release) {
        if (frame !== null) cancelAnimationFrame(frame)
        handle.style.removeProperty('transform')
        delete handle.dataset.dragging
        delete body.dataset.resizing
        if (!commit) return
        const value = sizeAt(release)
        if (value !== initial) set({ [side]: value })
      },
    })
  }
  const key = (event) => {
    if (event.currentTarget.parentElement.dataset.resizing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      toggle(event)
      return
    }
    const delta = across ? { ArrowRight: 16, ArrowLeft: -16 }[event.key] : { ArrowDown: 16, ArrowUp: -16 }[event.key]
    if (!delta) return
    event.preventDefault()
    set({ [side]: clamp(size + sign * delta) })
  }
  return (
    <div
      className={`studio-resize is-${side} ${open ? '' : 'is-shut'}`} role="separator" aria-orientation={across ? 'vertical' : 'horizontal'} tabIndex={0} aria-label={tr('拖动改大小，双击收起')}
      onPointerDown={drag} onDoubleClick={toggle} onClick={(event) => !open && toggle(event)} onKeyDown={key}
    />
  )
}
