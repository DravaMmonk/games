import { useId, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { T } from 'kernel/words'
import { L } from 'kernel/view'

// A world drawn the same wherever one is built or shown (a counterexample to build, one a translation is caught in):
// each thing a circle in a row, each property a chip under its thing, each name a tag there too, each two-place
// relation arrows between things (a loop when a thing relates to itself), each sentence letter a chip under the row.
//
//   world   { size, preds: { P: ['0', '0,1'] | true }, consts: { c: k } }      parts   core/worldValues.js worldParts
//   edit    { resize(n), toggle(p, key), flip(p), place(c, k) } | null: null only shows the world
//   frame   a run's frame (core/worldValues.js traceOf): the things its variables stand for and the facts it reads
//
// With a relation to build, a tap on a thing picks it as where arrows start; the arrows it could still have show
// dashed, and a tap on a thing (itself included) or on an arrow puts an arrow there or takes it away.

const D = 104 // from one thing to the next
const R = 20 // a thing's radius
const BEND = [42, 80] // how far an arrow between neighbours, or past one thing, bows away from the row

const centre = (k) => D / 2 + k * D
const rim = (k, deg, y) => ({ x: centre(k) + R * Math.cos((deg * Math.PI) / 180), y: y + R * Math.sin((deg * Math.PI) / 180) })

/** An arrow from thing a to thing b: a loop above a thing, rightwards above the row, leftwards under it. */
function arrowPath(a, b, y) {
  if (a === b) {
    const s = rim(a, -116, y)
    const e = rim(a, -64, y)
    return `M${s.x},${s.y} C${centre(a) - 24},${y - R - 38} ${centre(a) + 24},${y - R - 38} ${e.x},${e.y}`
  }
  const up = a < b
  const bow = BEND[Math.min(Math.abs(b - a), 2) - 1]
  const s = rim(a, up ? -18 : 162, y)
  const e = rim(b, up ? -162 : 18, y)
  const level = up ? y - R - bow : y + R + bow
  return `M${s.x},${s.y} C${s.x + (up ? 6 : -6)},${level} ${e.x + (up ? -6 : 6)},${level} ${e.x},${e.y}`
}

/** A relation's words for two things: 「①喜欢②」 with ③ and ① is 「③喜欢①」. */
const sayPair = (text, a, b) => L(text).replace(/[①②]/g, (mark) => (mark === '①' ? a : b))

// Each relation keeps its own stroke, so arrows of two relations in one world are told apart by their key.
const relClass = (k) => (k ? ` is-rel-${Math.min(k, 2)}` : '')
const Sample = ({ k }) => (
  <svg className="wg-sample" width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
    <path className={`wg-line${relClass(k)}`} d="M1,5 H13" />
    <path className="wg-sample-head" d="M12,1.5 L17,5 L12,8.5 z" />
  </svg>
)

export default function WorldGraph({ world, parts, edit = null, frame = null }) {
  const id = useId()
  const [from, setFrom] = useState(null) // the thing arrows start from, while picking where they go
  const [chosen, setChosen] = useState(0) // the relation being built, when there are several
  const n = world.size
  const things = Array.from({ length: n }, (_, k) => k)
  const start = from !== null && from < n ? from : null
  const rel = parts.rels[Math.min(chosen, parts.rels.length - 1)] ?? null
  const far = n > 2 ? 1 : 0
  const top = parts.rels.length ? R + BEND[far] + 4 : 8
  const y = top + R
  const height = y + R + (parts.rels.length && n > 1 ? BEND[far] + 4 : 26)
  const width = Math.max(1, n) * D
  const listOf = (p) => (world.preds?.[p] ?? []).filter((key) => key.split(',').every((x) => Number(x) < n))

  // What the run's frame reads: each fact by its predicate and things, true or not.
  const read = new Map((frame?.atoms ?? []).map((atom) => [`${atom.p}:${atom.args.join(',')}`, atom.on]))
  const tone = (key) => (read.has(key) ? (read.get(key) ? ' is-read' : ' is-read is-off') : '')
  const bound = things.map((k) => Object.entries(frame?.bind ?? {}).filter(([, d]) => d === k).map(([v]) => v))

  const tapThing = (k) => {
    if (!edit || !rel) return
    if (start === null) setFrom(k)
    else edit.toggle(rel.p, `${start},${k}`)
  }
  const keyed = (run) => (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); run() }
    if (event.key === 'Escape') setFrom(null)
  }

  // Every relation's arrows; only the one being built answers taps, the others stay faint behind it.
  const arrows = parts.rels.flatMap((r, k) => listOf(r.p).map((key) => ({ r, k, key, pair: key.split(',').map(Number) })))
  // The run reads an arrow that is not there: it shows where it would be.
  const missing = (frame?.atoms ?? []).filter((atom) => atom.args.length === 2 && !atom.on)
  const ghosts = edit && rel && start !== null
    ? things.filter((k) => !listOf(rel.p).includes(`${start},${k}`)).map((k) => [start, k])
    : []
  const marker = (name) => `url(#${CSS.escape(`${id}-${name}`)})`

  return (
    <div className={`wg${edit ? ' is-edit' : ''}`}>
      {(parts.rels.length > 0 || edit) && (
        <div className="wg-bar">
          <span className="wg-keys" role={edit && parts.rels.length > 1 ? 'group' : undefined}>
            {parts.rels.map((r, k) => (edit && parts.rels.length > 1
              ? <button key={r.p} type="button" className="wg-key" aria-pressed={r === rel} onClick={() => { setChosen(k); setFrom(null) }}><Sample k={k} />{L(r.text)}</button>
              : <span key={r.p} className="wg-key"><Sample k={k} />{L(r.text)}</span>))}
          </span>
          {edit && (
            <span className="wg-size">
              <button type="button" aria-label={L(T('减少一样东西'))} disabled={n <= 1} onClick={() => { setFrom(null); edit.resize(n - 1) }}><Minus size={16} /></button>
              <button type="button" aria-label={L(T('增加一样东西'))} disabled={n >= parts.marks.length} onClick={() => edit.resize(n + 1)}><Plus size={16} /></button>
            </span>
          )}
        </div>
      )}
      <div className="wg-scroll">
        <div className="wg-stage" style={{ width }}>
          <svg className="wg-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} onKeyDown={(event) => event.key === 'Escape' && setFrom(null)}>
            <defs>
              {['ink', 'faint', 'read', 'off'].map((name) => (
                <marker key={name} id={`${id}-${name}`} className={`wg-head is-${name}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0,1 L9,5 L0,9 z" />
                </marker>
              ))}
            </defs>
            <rect className="wg-ground" width={width} height={height} onClick={() => setFrom(null)} />
            {ghosts.map(([a, b]) => (
              <g key={`ghost-${a},${b}`} className="wg-arrow is-ghost" onClick={() => edit.toggle(rel.p, `${a},${b}`)}>
                <path className="wg-line" d={arrowPath(a, b, y)} markerEnd={marker('faint')} />
                <path className="wg-hit" d={arrowPath(a, b, y)} />
              </g>
            ))}
            {arrows.map(({ r, k, key, pair: [a, b] }) => {
              const lit = tone(`${r.p}:${key}`)
              const other = edit && r !== rel
              return (
                <g key={`${r.p}:${key}`} className={`wg-arrow${other ? ' is-other' : ''}${lit}`} onClick={edit && !other ? () => edit.toggle(r.p, key) : undefined}>
                  <title>{sayPair(r.text, parts.marks[a], parts.marks[b])}</title>
                  <path className={`wg-line${relClass(k)}`} d={arrowPath(a, b, y)} markerEnd={marker(lit ? 'read' : 'ink')} />
                  {edit && !other && <path className="wg-hit" d={arrowPath(a, b, y)} />}
                </g>
              )
            })}
            {missing.map((atom) => (
              <path key={`missing-${atom.p}:${atom.args}`} className="wg-arrow wg-line is-read is-off" d={arrowPath(atom.args[0], atom.args[1], y)} markerEnd={marker('off')} />
            ))}
            {things.map((k) => {
              const picked = start === k
              const label = parts.marks[k]
              // The circle is the mark's ring: inside it, the number alone.
              return (
                <g
                  key={k} className={`wg-thing${picked ? ' is-picked' : ''}${bound[k].length ? ' is-bound' : ''}`}
                  {...(edit && rel ? { role: 'button', tabIndex: 0, 'aria-label': label, 'aria-pressed': picked, onClick: () => tapThing(k), onKeyDown: keyed(() => tapThing(k)) } : {})}
                >
                  <circle className="wg-hit" cx={centre(k)} cy={y} r={R + 6} />
                  <circle className="wg-dot" cx={centre(k)} cy={y} r={R} />
                  <text className="wg-mark" x={centre(k)} y={y} dominantBaseline="central" textAnchor="middle">{k + 1}</text>
                  {bound[k].length > 0 && <text className="wg-var" x={centre(k)} y={y + R + 15} dominantBaseline="central" textAnchor="middle">{bound[k].join(' ')}</text>}
                </g>
              )
            })}
          </svg>
          {(parts.props.length > 0 || parts.consts.length > 0) && (
            <div className="wg-cols" style={{ gridTemplateColumns: `repeat(${n}, ${D}px)` }}>
              {things.map((k) => (
                <div key={k} className="wg-col">
                  {parts.consts.map(({ c, text }) => {
                    const on = Math.min(world.consts?.[c] ?? 0, n - 1) === k
                    if (!edit) return on ? <span key={c} className="wg-chip wg-name" data-on>{L(text)}</span> : null
                    return <button key={c} type="button" className="wg-chip wg-name" aria-pressed={on} onClick={() => edit.place(c, k)}>{L(text)}</button>
                  })}
                  {parts.props.map(({ p, text }) => {
                    const on = listOf(p).includes(String(k))
                    const lit = tone(`${p}:${k}`)
                    if (!edit) return <span key={p} className={`wg-chip${lit}`} data-on={on || undefined}>{L(text)}</span>
                    return <button key={p} type="button" className={`wg-chip${lit}`} aria-pressed={on} onClick={() => edit.toggle(p, String(k))}>{L(text)}</button>
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {parts.facts.length > 0 && (
        <div className="wg-facts">
          {parts.facts.map(({ p, text }) => {
            const on = Boolean(world.preds?.[p])
            const lit = tone(`${p}:`)
            return edit
              ? <button key={p} type="button" className={`wg-chip${lit}`} aria-pressed={on} onClick={() => edit.flip(p)}>{L(text)}</button>
              : <span key={p} className={`wg-chip${lit}`} data-on={on || undefined}>{L(text)}</span>
          })}
        </div>
      )}
    </div>
  )
}
