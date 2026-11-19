import { tr } from '../shell/i18n.js'
import { linkKey, wireCurve, wireMiddle } from './arrangement.js'

/** Draw the wires between the cards at their current port positions. */
export default function BoardWires({ edges, ports, width, height, wire, active, draft, pending, describe, onWire, onDelete, canDelete }) {
  return (
    <svg className="course-board-wires" width={width} height={height}>
      {edges.filter(({ from, to }) => ports.has(from) && ports.has(to)).map((edge) => {
        const key = linkKey(edge)
        const name = `${describe(edge.from)} → ${describe(edge.to)}`
        const d = wireCurve(ports.get(edge.from).output, ports.get(edge.to).input)
        return (
          <g key={key} className={`course-wire ${wire === key ? 'is-selected' : active === edge.from || active === edge.to ? 'is-near' : ''} ${edge.source === 'course' ? '' : 'is-derived'}`}>
            <path className="course-wire-halo" d={d} />
            <path className="course-wire-line" d={d} />
            <path className="course-wire-hit" d={d} role="button" tabIndex={0} aria-label={name} aria-pressed={wire === key}
              onClick={(event) => { event.stopPropagation(); onWire(edge) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWire(edge) } }}>
              <title>{name}</title>
            </path>
            {!pending && canDelete(edge) && <WireDelete at={wireMiddle(ports.get(edge.from).output, ports.get(edge.to).input)} name={name} onDelete={() => onDelete(edge)} />}
          </g>
        )
      })}
      {draft && <path className="course-wire-draft" d={draft} />}
    </svg>
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
