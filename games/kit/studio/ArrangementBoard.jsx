import { T } from '../shell/i18n.js'
// The Studio relation board (RelationBoard.jsx):
// cards with their input on the top edge and their output on the bottom edge, wires from one card's output to
// another's input. It wires as the circuit board does (packages/circuit/view/board/CanvasEditor.jsx): click a dot to
// take a wire in hand (either end), then a dot of the other kind or a whole card to plug it in; the dots it may go to
// pulse, a draft wire follows the pointer, a click on the same dot or on the empty board drops it. A wire is also
// pulled from an output and let go on an input or a card. A wire refused says why at the top of the board for a
// moment. A wire, and on a board that lets cards go a card, has a small delete button beside it (the wire's at its
// middle, while it is picked or the pointer is on it; the card's at its corner); Delete or Backspace removes the wire
// or card picked; Escape drops what is in hand, then what is picked. Its cards show each endpoint's id and name, the
// id alone or the name alone (the author's choice, kept), on one line, each card as wide as its words: never cut short.
import { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { L, tr } from '../shell/i18n.js'
import { usePref } from './prefs.js'
import { useElementSize } from '../views/useElementSize.js'
import { usePointerSession } from '../views/usePointerSession.js'
import { boardGeometry } from './arrangement.js'
import BoardWires from './BoardWires.jsx'
import { useBoardWiring } from './useBoardWiring.js'

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
  const [positions, setPositions] = useState(new Map())
  const [moving, setMoving] = useState(null)
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
  const wiring = useBoardWiring({
    canvas, hosted: board.hosted, edges: board.edges, ports, track, pending, active, wire, isExternal,
    refuse, onConnect, onDelete, onLevel, onWire, onCancel, onRemoveCard,
  })
  const moveCard = (event, id, x, y) => {
    if (event.button !== 0) return
    wiring.skipClick.current = false
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
        wiring.skipClick.current = true
        setMoving(position)
      },
      finish(commit) {
        setMoving(null)
        if (commit && position) setPositions((old) => new Map(old).set(id, position))
      },
    })
  }
  return (
    <div className={`course-board-frame ${wiring.held ? 'is-picking' : ''}`}>
      <span className="seg course-board-labels" role="radiogroup" aria-label={tr("卡片上写什么")}>
        {[['both', T("id · 名字")], ['id', "id"], ['title', T("名字", {}, "arrangement-board")]].map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={shows === value} className={shows === value ? 'is-on' : ''} onClick={() => setShows(value)}>{L(label)}</button>
        ))}
      </span>
      <div ref={scroller} className="course-board" aria-label={tr("关卡接线板")}
        onPointerMove={wiring.pointAt}
        onPointerDown={(event) => { if (event.target === scroller.current || event.target === canvas.current) wiring.skipClick.current = false }}
        onClick={(event) => {
          // A click on the empty board drops the wire in hand, or the wire picked. A pull that ends on another card
          // clicks the board they share: that is the pull's end, not a click.
          if (wiring.skipClick.current) { wiring.skipClick.current = false; return }
          if (event.target !== scroller.current && event.target !== canvas.current) return
          wiring.cancel()
        }}>
        <div className="course-board-canvas" ref={canvas} style={{ width: boardWidth, height }}>
          <BoardWires edges={board.edges} ports={ports} width={boardWidth} height={height} wire={wire} active={active}
            draft={wiring.draft} pending={pending} describe={describe} onWire={wiring.pickWire}
            onDelete={wiring.deleteWire} canDelete={() => Boolean(onDelete)} />
          {cards.map(({ id, portal, x, y, width, height }) => (
            <div key={id} className={`course-card ${portal ? 'is-portal' : ''} ${moving?.id === id ? 'is-moving' : ''} ${active === id ? 'is-active' : ''}`} data-course-card={id}
              style={{ left: x, top: y, width, height }}>
              {portal && <div className="course-card-head">{whereFrom(id)}</div>}
              {onRemoveCard && !pending && !portal && <button type="button" className="course-card-x" aria-label={`${removeCardLabel} ${describe(id)}`} title={removeCardLabel}
                onClick={(event) => { event.stopPropagation(); wiring.clearWire(); onRemoveCard(id) }}><X size={11} aria-hidden="true" /></button>}
              <button type="button" className={`course-card-label ${active === id ? 'is-current' : ''}`}
                onPointerDown={(event) => moveCard(event, id, x, y)} onClick={(event) => wiring.click(event, () => wiring.pickCard(id))} title={describe(id)} aria-current={active === id ? 'true' : undefined}>
                {face(id).id && <code>{face(id).id}</code>}{face(id).title && <span>{face(id).title}</span>}{badges(id)}
              </button>
              <button type="button" {...wiring.port(id, 'in', describe)} />
              <button type="button" {...wiring.port(id, 'out', describe)} />
            </div>
          ))}
        </div>
      </div>
      {wiring.said && <p key={wiring.said.at} className="course-board-refusal" role="status">{wiring.said.text}</p>}
    </div>
  )
}
