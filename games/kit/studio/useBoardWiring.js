import { useEffect, useRef, useState } from 'react'
import { tr } from '../shell/i18n.js'
import { linkKey, wireCurve } from './arrangement.js'

const typing = (target) => target?.matches?.('input, textarea, select, [contenteditable], [contenteditable] *')
const neverReadOnly = () => false
const SAID_MS = 4200

/** Wire gestures shared by the relation board and the chapter map. */
export function useBoardWiring({ canvas, hosted, edges, ports, track, pending, active, wire, isExternal, isReadOnly = neverReadOnly, refuse, onConnect, onDelete, onLevel, onWire, onCancel, onRemoveCard, onStart }) {
  const [drag, setDrag] = useState(null)
  const [hand, setHand] = useState(null)
  const [pointer, setPointer] = useState(null)
  const [said, setSaid] = useState(null)
  const skipClick = useRef(false)
  const held = hand && hosted.has(hand.id) && !pending ? hand : null
  const wired = { in: new Set(edges.map(({ to }) => to)), out: new Set(edges.map(({ from }) => from)) }
  const picked = edges.find((edge) => linkKey(edge) === wire) ?? null
  const removeWire = (edge) => say(onDelete?.(edge) ?? null)

  const take = (next) => { setHand(next); setPointer(null) }
  const say = (text) => setSaid(text ? { text, at: Date.now() } : null)
  useEffect(() => {
    if (!said) return undefined
    const timer = window.setTimeout(() => setSaid(null), SAID_MS)
    return () => window.clearTimeout(timer)
  }, [said])
  // From → to, as an end in hand and the end it goes to make it.
  const ends = (end, id) => (end.side === 'out' ? [end.id, id] : [id, end.id])
  const connect = (from, to) => {
    const why = refuse(from, to) ?? onConnect(from, to) ?? null
    say(why)
    return !why
  }
  const pickDot = (id, side) => {
    if (pending) return
    if (held?.id === id && held.side === side) return take(null)
    if (!held || held.side === side) {
      onStart?.()
      return take({ id, side })
    }
    if (connect(...ends(held, id))) take(null)
  }
  const pickCard = (id) => {
    if (!held) return onLevel(id)
    if (!hosted.has(id)) return
    if (held.id === id) return take(null)
    // A card takes the wire on its own end of the other kind: an output in hand goes to its input, and so on.
    if (held.side === 'in' && isReadOnly(id)) return
    if (held.side === 'out' && isExternal(id)) return say(tr("外部关卡不能接入。"))
    if (connect(...ends(held, id))) take(null)
  }
  const target = (id, side) => Boolean(held) && held.side !== side && held.id !== id && !isReadOnly(id) && !(side === 'in' && isExternal(id)) && !refuse(...ends(held, id))

  // Escape drops the wire in hand, then the wire picked; Delete or Backspace removes the wire picked.
  const keys = useRef(null)
  keys.current = (event) => {
    if (event.defaultPrevented || typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'Escape' && (held || picked || active)) {
      if (held) take(null)
      else onCancel()
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && !held && !event.repeat && !pending) {
      if (picked) { event.preventDefault(); removeWire(picked) }
      else if (active && onRemoveCard && hosted.has(active)) { event.preventDefault(); onRemoveCard(active) }
    }
  }
  useEffect(() => {
    const listen = (event) => keys.current(event)
    window.addEventListener('keydown', listen)
    return () => window.removeEventListener('keydown', listen)
  }, [])

  const point = (event) => {
    const rect = canvas.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  // A wire pulled from an output goes where it is let go: an input, or a card; anywhere else it is dropped.
  const pull = (event, id) => {
    if (pending || isReadOnly(id) || event.pointerType !== 'mouse' || event.button !== 0) return
    skipClick.current = false
    const { clientX, clientY } = event
    let travelled = false
    track(event, {
      escape: true,
      move(move) {
        if (!travelled) {
          if (Math.hypot(move.clientX - clientX, move.clientY - clientY) < 5) return
          travelled = true
          skipClick.current = true
          onStart?.()
          take(null)
        }
        setDrag({ from: id, to: point(move) })
      },
      finish(commit, release) {
        setDrag(null)
        if (!commit || !travelled) return
        const over = document.elementFromPoint(release.clientX, release.clientY)
        const to = over?.closest('[data-course-input]')?.dataset.courseInput ?? over?.closest('[data-course-card]')?.dataset.courseCard
        if (!hosted.has(to) || to === id) return
        if (isExternal(to)) say(tr("外部关卡不能接入。"))
        else connect(id, to)
      },
    })
  }
  const click = (event, action) => {
    if (!event.detail || !skipClick.current) action()
    skipClick.current = false
  }
  const draft = drag && ports.has(drag.from) ? wireCurve(ports.get(drag.from).output, drag.to)
    : held && pointer && ports.has(held.id) ? (held.side === 'out' ? wireCurve(ports.get(held.id).output, pointer) : wireCurve(pointer, ports.get(held.id).input))
      : null
  const port = (id, side, describe) => {
    const input = side === 'in'
    const selected = (held?.id === id && held.side === side) || (!input && drag?.from === id)
    return {
      className: `course-port is-${input ? 'input' : 'output'} ${wired[side].has(id) ? 'is-wired' : ''} ${selected ? 'is-picked' : target(id, side) ? 'is-target' : ''}`,
      'data-course-input': input && !isExternal(id) ? id : undefined,
      'aria-label': `${input ? tr("输入") : tr("输出")} ${describe(id)}`,
      'aria-pressed': selected,
      title: input ? tr("前置接到这里") : tr("从这里接到后续"),
      disabled: pending || isReadOnly(id) || (input && isExternal(id)),
      onPointerDown: input ? undefined : (event) => pull(event, id),
      onClick: (event) => click(event, () => pickDot(id, side)),
    }
  }

  return {
    held, picked, said, draft, port, pickCard, click, skipClick,
    pointAt: (event) => { if (held) setPointer(point(event)) },
    cancel: () => { if (held) take(null); else onCancel() },
    pickWire: (edge) => { take(null); onWire(edge) },
    deleteWire: (edge) => { take(null); removeWire(edge) },
    clearWire: () => take(null),
  }
}
