import { T } from '../shell/i18n.js'
// The wiring board the studio's relation board (RelationBoard.jsx) and a chapter's links (ChapterBoard.jsx) share:
// cards with their input on the top edge and their output on the bottom edge, wires from one card's output to
// another's input. It wires as the circuit board does (packages/circuit/view/board/CanvasEditor.jsx): click a dot to
// take a wire in hand (either end), then a dot of the other kind or a whole card to plug it in; the dots it may go to
// pulse, a draft wire follows the pointer, a click on the same dot or on the empty board drops it. A wire is also
// pulled from an output and let go on an input or a card. A wire refused says why at the top of the board for a
// moment. A wire, and on a board that lets cards go a card, has a small delete button beside it (the wire's at its
// middle, while it is picked or the pointer is on it; the card's at its corner); Delete or Backspace removes the wire
// or card picked; Escape drops what is in hand, then what is picked. Its cards show each endpoint's id and name, the
// id alone or the name alone (the author's choice, kept), on one line, each card as wide as its words: never cut short.
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { L, tr } from '../shell/i18n.js'
import { usePref } from './prefs.js'
import { useElementSize } from '../views/useElementSize.js'
import { usePointerSession } from '../views/usePointerSession.js'
import { boardGeometry, linkKey, wireCurve, wireMiddle } from './arrangement.js'

const SAID_MS = 4200 // how long a refusal stays on the board, as on the circuit board
const MIN_CARD = 110 // the narrowest card, ports and all
const CARD_PADDING = 28 // a card's label's padding, both sides
const BADGE = 46 // room for a card's marks (optional, skippable)

/** The width of a text in the board's label fonts ('mono' for ids, 'sans' for names), measured once each. */
function useMeasure() {
  return useMemo(() => {
    const context = document.createElement('canvas').getContext('2d')
    const style = getComputedStyle(document.documentElement)
    const size = style.getPropertyValue('--fs-mini').trim() || '10.5px'
    const fonts = { mono: `${size} ${style.getPropertyValue('--mono').trim() || 'monospace'}`, sans: `${size} ${style.getPropertyValue('--sans').trim() || 'sans-serif'}` }
    const known = new Map()
    return (text, font) => {
      const key = `${font} ${text}`
      if (!known.has(key)) { context.font = fonts[font]; known.set(key, context.measureText(text).width) }
      return known.get(key)
    }
  }, [])
}

const typing = (target) => target?.matches?.('input, textarea, select, [contenteditable], [contenteditable] *')

/**
 * `idOf(id)`: an endpoint's id as shown, `titleOf(id)` its name, `badges(id)` marks after it (optional, skippable);
 * `refuse(from, to)`: why a wire from → to may not be made (a text), or null; `onConnect(from, to)` and
 * `onDelete(edge)` make or remove one and may answer with a refusal to show. `wire`: the key (arrangement.js linkKey)
 * of the wire picked; `active`: the card picked. `onRemoveCard(id)`, when given, takes a card off the board
 * (`removeCardLabel` names it).
 */
export default function ArrangementBoard({ board, idOf = (id) => id, titleOf = () => '', badges = () => null, describe, portal: whereFrom = () => tr("外部关卡"), active, wire, pending, isExternal, refuse = () => null, onLevel, onWire, onConnect, onDelete, onRemoveCard = null, removeCardLabel = '', onCancel }) {
  const scroller = useRef(null)
  const canvas = useRef(null)
  const width = useElementSize(scroller)?.width ?? 520
  const { track } = usePointerSession()
  const [drag, setDrag] = useState(null)
  const [positions, setPositions] = useState(new Map())
  const [moving, setMoving] = useState(null)
  // The wire in hand: the end picked ({ id, side: 'in' | 'out' }), and where the pointer is while it is.
  const [hand, setHand] = useState(null)
  const [pointer, setPointer] = useState(null)
  const [said, setSaid] = useState(null)
  const skipClick = useRef(false)
  const preview = moving ? new Map(positions).set(moving.id, moving) : positions
  // What a card says: id and name, the id, or the name (a card with no name says its id).
  const [shows, setShows] = usePref('board-labels', 'both')
  const face = (id) => {
    const title = titleOf(id) ?? ''
    return { id: shows === 'title' && title ? null : idOf(id), title: shows === 'id' || !title ? null : title }
  }
  const measure = useMeasure()
  const widthOf = (id) => {
    const { id: shown, title } = face(id)
    const words = (shown ? measure(shown, 'mono') : 0) + (title ? measure(title, 'sans') : 0) + (shown && title ? 6 : 0)
    return Math.max(MIN_CARD, Math.ceil(words + CARD_PADDING + (badges(id) ? BADGE : 0)))
  }
  const { cards, ports, width: boardWidth, height } = boardGeometry(board.rows, width, preview, widthOf)
  const held = hand && board.hosted.has(hand.id) && !pending ? hand : null
  const wired = { in: new Set(board.edges.map(({ to }) => to)), out: new Set(board.edges.map(({ from }) => from)) }
  const picked = board.edges.find((edge) => linkKey(edge) === wire) ?? null
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
    if (!held || held.side === side) return take({ id, side })
    if (connect(...ends(held, id))) take(null)
  }
  const pickCard = (id) => {
    if (!held) return onLevel(id)
    if (held.id === id) return take(null)
    // A card takes the wire on its own end of the other kind: an output in hand goes to its input, and so on.
    if (held.side === 'out' && isExternal(id)) return say(tr("外部关卡不能接入。"))
    if (connect(...ends(held, id))) take(null)
  }
  const target = (id, side) => Boolean(held) && held.side !== side && held.id !== id && !(side === 'in' && isExternal(id)) && !refuse(...ends(held, id))

  // Escape drops the wire in hand, then the wire picked; Delete or Backspace removes the wire picked.
  const keys = useRef(null)
  keys.current = (event) => {
    if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'Escape' && (held || picked || active)) {
      if (held) take(null)
      else onCancel()
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && !held && !event.repeat && !pending) {
      if (picked) { event.preventDefault(); removeWire(picked) }
      else if (active && onRemoveCard && board.hosted.has(active)) { event.preventDefault(); onRemoveCard(active) }
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
  const moveCard = (event, id, x, y) => {
    if (event.button !== 0) return
    skipClick.current = false
    const { clientX, clientY } = event
    const initialScroll = scroller.current.scrollTop
    let position
    track(event, {
      escape: true,
      capture: true,
      move(move) {
        const dx = move.clientX - clientX
        const dy = move.clientY - clientY
        if (!position && Math.hypot(dx, dy) < 5) return
        position = { id, x: x + dx, y: y + dy + scroller.current.scrollTop - initialScroll }
        skipClick.current = true
        setMoving(position)
      },
      finish(commit) {
        setMoving(null)
        if (commit && position) setPositions((old) => new Map(old).set(id, position))
      },
    })
  }
  // A wire pulled from an output goes where it is let go: an input, or a card; anywhere else it is dropped.
  const pull = (event, id) => {
    if (pending || event.pointerType !== 'mouse' || event.button !== 0) return
    skipClick.current = false
    const { clientX, clientY } = event
    let travelled = false
    track(event, {
      escape: true,
      move(move) {
        travelled ||= Math.hypot(move.clientX - clientX, move.clientY - clientY) >= 5
        if (!travelled) return
        skipClick.current = true
        take(null)
        setDrag({ from: id, to: point(move) })
      },
      finish(commit, release) {
        setDrag(null)
        if (!commit || !travelled) return
        const over = document.elementFromPoint(release.clientX, release.clientY)
        const to = over?.closest('[data-course-input]')?.dataset.courseInput ?? over?.closest('[data-course-card]')?.dataset.courseCard
        if (to === undefined || to === id) return
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
  return (
    <div className={`course-board-frame ${held ? 'is-picking' : ''}`}>
      <span className="seg course-board-labels" role="radiogroup" aria-label={tr("卡片上写什么")}>
        {[['both', T("id · 名字")], ['id', "id"], ['title', T("名字", {}, "arrangement-board")]].map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={shows === value} className={shows === value ? 'is-on' : ''} onClick={() => setShows(value)}>{L(label)}</button>
        ))}
      </span>
      <div ref={scroller} className="course-board" aria-label={tr("关卡接线板")}
        onPointerMove={(event) => { if (held) setPointer(point(event)) }}
        onPointerDown={(event) => { if (event.target === scroller.current || event.target === canvas.current) skipClick.current = false }}
        onClick={(event) => {
          // A click on the empty board drops the wire in hand, or the wire picked. A pull that ends on another card
          // clicks the board they share: that is the pull's end, not a click.
          if (skipClick.current) { skipClick.current = false; return }
          if (event.target !== scroller.current && event.target !== canvas.current) return
          if (held) take(null)
          else onCancel()
        }}>
        <div className="course-board-canvas" ref={canvas} style={{ width: boardWidth, height }}>
          <svg className="course-board-wires" width={boardWidth} height={height}>
            {board.edges.map((edge) => {
              const key = linkKey(edge)
              const name = `${describe(edge.from)} → ${describe(edge.to)}`
              const d = wireCurve(ports.get(edge.from).output, ports.get(edge.to).input)
              return (
                <g key={key} className={`course-wire ${wire === key ? 'is-selected' : active === edge.from || active === edge.to ? 'is-near' : ''} ${edge.source === 'course' ? '' : 'is-derived'}`}>
                  <path className="course-wire-halo" d={d} />
                  <path className="course-wire-line" d={d} />
                  <path className="course-wire-hit" d={d} role="button" tabIndex={0} aria-label={name} aria-pressed={wire === key}
                    onClick={(event) => { event.stopPropagation(); take(null); onWire(edge) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); take(null); onWire(edge) } }}>
                    <title>{name}</title>
                  </path>
                  {!pending && onDelete && <WireDelete at={wireMiddle(ports.get(edge.from).output, ports.get(edge.to).input)} name={name} onDelete={() => { take(null); removeWire(edge) }} />}
                </g>
              )
            })}
            {draft && <path className="course-wire-draft" d={draft} />}
          </svg>
          {cards.map(({ id, portal, x, y, width, height }) => (
            <div key={id} className={`course-card ${portal ? 'is-portal' : ''} ${moving?.id === id ? 'is-moving' : ''} ${active === id ? 'is-active' : ''}`} data-course-card={id}
              style={{ left: x, top: y, width, height }}>
              {portal && <div className="course-card-head">{whereFrom(id)}</div>}
              {onRemoveCard && !pending && !portal && <button type="button" className="course-card-x" aria-label={`${removeCardLabel} ${describe(id)}`} title={removeCardLabel}
                onClick={(event) => { event.stopPropagation(); take(null); onRemoveCard(id) }}><X size={11} aria-hidden="true" /></button>}
              <button type="button" className={`course-card-label ${active === id ? 'is-current' : ''}`}
                onPointerDown={(event) => moveCard(event, id, x, y)} onClick={(event) => click(event, () => pickCard(id))} title={describe(id)} aria-current={active === id ? 'true' : undefined}>
                {face(id).id && <code>{face(id).id}</code>}{face(id).title && <span>{face(id).title}</span>}{badges(id)}
              </button>
              <button type="button" className={`course-port is-input ${wired.in.has(id) ? 'is-wired' : ''} ${held?.id === id && held.side === 'in' ? 'is-picked' : target(id, 'in') ? 'is-target' : ''}`}
                data-course-input={isExternal(id) ? undefined : id} aria-label={`${tr("输入")} ${describe(id)}`} aria-pressed={held?.id === id && held.side === 'in'}
                title={tr("前置接到这里")} disabled={pending || isExternal(id)}
                onClick={() => pickDot(id, 'in')} />
              <button type="button" className={`course-port is-output ${wired.out.has(id) ? 'is-wired' : ''} ${(held?.id === id && held.side === 'out') || drag?.from === id ? 'is-picked' : target(id, 'out') ? 'is-target' : ''}`}
                aria-label={`${tr("输出")} ${describe(id)}`} aria-pressed={held?.id === id && held.side === 'out'} title={tr("从这里接到后续")}
                disabled={pending} onPointerDown={(event) => pull(event, id)} onClick={(event) => click(event, () => pickDot(id, 'out'))} />
            </div>
          ))}
        </div>
      </div>
      {said && <p key={said.at} className="course-board-refusal" role="status">{said.text}</p>}
    </div>
  )
}

/** A wire's delete button at its middle: a small round ×, in the board's SVG so it rides with the wire. */
function WireDelete({ at, name, onDelete }) {
  return (
    <g className="course-wire-x" transform={`translate(${at.x} ${at.y})`} role="button" tabIndex={-1} aria-label={`${tr("断开连线")} ${name}`}
      onClick={(event) => { event.stopPropagation(); onDelete() }}>
      <title>{tr("断开连线")}</title>
      <circle r={12} className="course-wire-x-hit" />
      <circle r={8} className="course-wire-x-dot" />
      <path d="M-3 -3L3 3M3 -3L-3 3" />
    </g>
  )
}
