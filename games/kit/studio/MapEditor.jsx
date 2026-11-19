// The arrange workspace's map editor (games/design/README.md 2.6, 6.7): a chapter's route map, the `rows` in its chapter file,
// row by row, one to three places a row. A level is dragged to a place (or picked, then its place clicked: the way on
// a phone), to a row of its own between rows, or off the map; places and rows are put in and taken out; the chapter's
// levels no row places wait below. A move that would put a prerequisite in a row not above the level that needs it is
// refused.
import { useLayoutEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { tr } from '../shell/i18n.js'
import { usePointerSession } from '../views/usePointerSession.js'
import { linkKey } from './arrangement.js'
import BoardWires from './BoardWires.jsx'
import { useBoardWiring } from './useBoardWiring.js'
import { ROW_SLOTS, addPlace, addRow, clearLevel, layoutRefusal, placeLevel, placeOf, removePlace } from './layout-edit.js'

/** What a drop target's key says: a place, a new row before a row, or off the map. */
function dropOf(key) {
  const [kind, a, b] = String(key).split(':')
  if (kind === 'slot') return { row: Number(a), slot: Number(b) }
  if (kind === 'gap') return { row: Number(a), new: true }
  return kind === 'off' ? { off: true } : null
}
const dropAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-drop]')?.dataset.drop ?? null

/** Measure port positions relative to the scrollable map, including loose and external cards. */
function useMapPorts(canvas, rows, members, external, showLoose) {
  const [ports, setPorts] = useState(new Map())
  const measured = useRef(null)
  useLayoutEffect(() => {
    const root = canvas.current
    const measure = () => {
      const rect = root.getBoundingClientRect()
      const next = new Map([...root.querySelectorAll('[data-course-card]')].map((card) => {
        const box = card.getBoundingClientRect()
        const x = box.left - rect.left + box.width / 2
        return [card.dataset.courseCard, { input: { x, y: box.top - rect.top }, output: { x, y: box.bottom - rect.top } }]
      }))
      const stamp = JSON.stringify([...next])
      if (measured.current === stamp) return
      measured.current = stamp
      setPorts(next)
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(root)
    return () => resize.disconnect()
  }, [canvas, rows, members, external, showLoose])
  return ports
}

export default function MapEditor({ rows, members, layoutEdges, links, external, titleOf, describe, selected, pending, wiringPending, onRows, onPick, refuse, onConnect, onDelete }) {
  const placed = new Set(rows.flat())
  const loose = members.filter((id) => !placed.has(id))
  const hosted = new Set([...members, ...external.keys()])
  const [armed, setArmed] = useState(null)
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(null)
  const [over, setOver] = useState(null)
  const [wire, setWire] = useState(null)
  const canvas = useRef(null)
  const showLoose = loose.length > 0 || Boolean(armed || dragging)
  const ports = useMapPorts(canvas, rows, members, external, showLoose)
  const { track } = usePointerSession()
  const canDelete = (edge) => !edge.fromGame
  const move = (id, to) => {
    if (pending || !to) return
    const next = to.off ? clearLevel(rows, id) : placeLevel(rows, id, to)
    if (next === rows || (to.off && !placeOf(rows, id))) { setArmed(null); return }
    const bad = layoutRefusal(rows, next, layoutEdges)
    if (bad) {
      setNotice(tr("{value} 是 {value2} 的前置，须排在它上面的行。", {value: describe(bad.from), value2: describe(bad.to)}))
      return
    }
    setNotice('')
    setArmed(null)
    onRows(next)
  }
  const edit = (next) => { if (!pending && next !== rows) { setNotice(''); onRows(next) } }
  const pick = (id) => {
    if (external.has(id)) return
    const place = placeOf(rows, id)
    if (armed && armed !== id && place) { move(armed, place); return }
    setNotice('')
    setWire(null)
    setArmed(armed === id ? null : id)
    onPick(id)
  }
  const wiring = useBoardWiring({
    canvas, hosted, edges: links, ports, track, pending: wiringPending, active: armed, wire,
    isExternal: (id) => external.has(id), isReadOnly: (id) => Boolean(external.get(id)?.fromGame), refuse,
    onConnect: (from, to) => {
      const reason = onConnect(from, to)
      if (!reason) setWire(linkKey({ from, to }))
      return reason
    },
    onDelete: (edge) => {
      const reason = onDelete(edge)
      if (!reason) setWire(null)
      return reason
    },
    onLevel: pick,
    onStart: () => { setArmed(null); setNotice(''); setWire(null) },
    onWire: (edge) => { setArmed(null); setNotice(''); setWire(linkKey(edge)) },
    onCancel: () => { setArmed(null); setNotice(''); setWire(null) },
  })

  // Pointer drags move a card; touch users can also choose a card, then choose its slot.
  const grab = (event, id) => {
    if (event.button !== 0) return
    wiring.skipClick.current = false
    if (pending || wiring.held || external.has(id)) return
    const { clientX, clientY } = event
    let moved = false
    track(event, {
      escape: true,
      move(next) {
        if (!moved && Math.hypot(next.clientX - clientX, next.clientY - clientY) < 6) return
        moved = true
        wiring.skipClick.current = true
        setDragging(id)
        setOver(dropAt(next.clientX, next.clientY))
      },
      finish(commit, release) {
        setDragging(null)
        setOver(null)
        if (commit && moved) move(id, dropOf(dropAt(release.clientX, release.clientY)))
      },
    })
  }
  const target = (key, to) => ({
    'data-drop': key,
    'data-over': over === key ? '' : undefined,
    onClick: armed && !pending && !wiring.held ? (e) => { if (e.target === e.currentTarget) move(armed, to) } : undefined,
  })
  const level = (id, to) => {
    const portal = external.get(id)
    const name = portal?.fromGame ? describe(id) : titleOf(id)
    const classes = `${members.includes(id) ? '' : 'is-auto'} ${armed === id || selected === id ? 'is-on' : ''} ${dragging === id ? 'is-moving' : ''}`
    return (
      <div key={id} className="map-card" data-course-card={id} {...(to && target(`slot:${to.row}:${to.slot}`, to))}>
        <button type="button" className={`map-place ${classes}`} title={describe(id)} aria-pressed={armed === id}
          disabled={pending} onPointerDown={(event) => grab(event, id)}
          onClick={(event) => wiring.click(event, () => wiring.pickCard(id))}>
          {!portal?.fromGame && <code>{id}</code>}<span>{name}</span>
        </button>
        {members.includes(id) && <button type="button" {...wiring.port(id, 'in', describe)} />}
        {hosted.has(id) && <button type="button" {...wiring.port(id, 'out', describe)} />}
      </div>
    )
  }
  const reach = !wiring.held && (armed || dragging)
  const gap = (row) => reach && !pending
    ? <div className="map-gap is-armed" role="button" tabIndex={0} aria-label={tr("放进新的一行")} {...target(`gap:${row}`, { row, new: true })}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); move(armed, { row, new: true }) } }} />
    : <div className="map-gap" />
  return (
    <div className={`map-layout layout-editor ${wiring.held ? 'is-picking' : ''}`}>
      <div className="arrange-actions">
        <span className="object-count">{members.filter((id) => placed.has(id)).length}/{members.length}</span>
        {wiring.picked && <strong>{describe(wiring.picked.from)} → {describe(wiring.picked.to)}</strong>}
        {armed && <>
          <strong>{describe(armed)}</strong>
          {placeOf(rows, armed) && <button type="button" className="kit-btn is-label" disabled={pending} onClick={() => move(armed, { off: true })}>
            <X size={13} aria-hidden="true" />{tr("移出路线图")}
          </button>}
        </>}
        {(notice || wiring.said) && <p className="is-error" role="status">{notice || wiring.said.text}</p>}
      </div>
      <div className="map-rows" aria-label={tr("路线图")} onPointerMove={wiring.pointAt}
        onPointerDown={(event) => {
          if (!event.target.closest('button, [role="button"], [data-drop]')) wiring.skipClick.current = false
        }}
        onClick={(event) => {
          if (event.target.closest('button, [role="button"], [data-drop]') || wiring.skipClick.current) return
          wiring.cancel()
        }}>
        <div className="map-canvas" ref={canvas}>
          <BoardWires edges={links} ports={ports} width="100%" height="100%" wire={wire} active={selected}
            draft={wiring.draft} pending={wiringPending} describe={describe} onWire={wiring.pickWire}
            onDelete={wiring.deleteWire} canDelete={canDelete} />
          {external.size > 0 && <div className="map-external" aria-label={tr("外部关卡")}>
            {[...external.keys()].map((id) => level(id, null))}
          </div>}
          {gap(0)}
          {rows.map((row, r) => (
            <div key={r} className="map-row-wrap">
              <div className="map-row">
                {row.length < ROW_SLOTS && <div className="map-place is-end" aria-hidden="true" />}
                {row.map((id, slot) => id === null
                  ? <div key={`empty-${slot}`} className="map-place is-empty" {...target(`slot:${r}:${slot}`, { row: r, slot })}>
                    {!pending && <button type="button" className="kit-btn editor-tool" title={tr("去掉这个空位")} aria-label={tr("去掉这个空位")} onClick={() => edit(removePlace(rows, r, slot))}><X size={12} aria-hidden="true" /></button>}
                  </div>
                  : level(id, { row: r, slot }))}
                {row.length < ROW_SLOTS && <div className="map-place is-end" {...target(`slot:${r}:${row.length}`, { row: r, slot: row.length })}>
                  {!pending && <button type="button" className="kit-btn editor-tool" title={tr("加一个空位")} aria-label={tr("加一个空位")} onClick={() => edit(addPlace(rows, r))}><Plus size={12} aria-hidden="true" /></button>}
                  </div>}
              </div>
              {gap(r + 1)}
            </div>
          ))}
          {!pending && <div className="map-row">
            <button type="button" className="kit-btn is-label" onClick={() => edit(addRow(rows))}><Plus size={13} aria-hidden="true" />{tr("加一行")}</button>
          </div>}
          {showLoose && <div className="layout-unplaced" aria-label={tr("未排入")} {...target('off', { off: true })}>
            {loose.map((id) => level(id, null))}
          </div>}
        </div>
      </div>
    </div>
  )
}
