// The relation board of the package workspace (games/DESIGN.md 6.1, 6.7): one relation at a time on the wiring board
// (ArrangementBoard.jsx). Its endpoints are cards (a level, a part or a whole tag), its edges are wires, made and
// taken off as on the circuit board; a prerequisite picked can require a pass. Requires and replaces (`edges` fields,
// games/MODULES.md 5.3.1) are drawn and edited the same way. Another layer's relations are read only.
// Every edit is at once an operation of the pending changeset (undone and redone from the studio's bar or ⌘Z), and the
// board shows it before the preview comes back (pending-view.js), so wiring never waits.
// The list of relations is the left column's (ObjectLists.jsx); its file the right's.
import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { L, tr } from '../shell/i18n.js'
import { Picker } from './Picker.jsx'
import ArrangementBoard from './ArrangementBoard.jsx'
import { linkKey, wiringBoard, wiringRefusal } from './arrangement.js'
import { confirmDelete } from './delete.js'
import { localName, namespaceOf, shownName, tagByRef, tagCandidates } from './objects-edit.js'
import SourceMark from './SourceMark.jsx'
import { overridesIt, relationOverrideOps } from './override-edit.js'
import { pendingValue, writtenBy } from './pending-view.js'
import { declaredEdges, endpointKind, endpointsOf, withEdge, withRequired, withoutEdge, withoutEndpoint, writeEdges } from './relation-edit.js'

const refusal = (reason) => ({
  self: tr('不能接到自己。', 'An endpoint cannot link to itself.'),
  duplicate: tr('这条连线已存在。', 'This wire already exists.'),
  cycle: tr('这条连线会形成循环。', 'This wire would create a cycle.'),
})[reason]

// What each operation a board wrote holds (pending-view.js writtenBy).
const writes = new WeakMap()
// The cards placed on a board without a wire yet, by layer and relation: they stay while the author looks elsewhere.
const placedOn = new Map()

/**
 * The relation `full` (a relation group picked in a build list); `onPick(path)` shows a field of its file on the right.
 * `ops`: the pending changeset; `previewOps`: the operations the content shown was previewed with; `applying`: the
 * changeset is being written.
 */
export default function RelationBoard({ content, namespace, full, ops = [], previewOps = [], applying = false, pending, onSelect, onEdit, onOps, onPick }) {
  const relation = content?.registries?.relation?.[full]
  if (!relation) return <article className="arrange" />
  return <OneRelation key={full} full={full} name={localName(namespace, full)} relation={relation} own={namespaceOf(full) === namespace} content={content} namespace={namespace}
    ops={ops} previewOps={previewOps} applying={applying} pending={pending} onSelect={onSelect} onEdit={onEdit} onOps={onOps} onPick={onPick} />
}

function OneRelation({ full, name, relation, own, content, namespace, ops, previewOps, applying, pending, onSelect, onEdit, onOps, onPick }) {
  const kind = endpointKind(relation)
  const boardKey = `${namespace}|${full}`
  const saved = useMemo(() => declaredEdges(relation), [relation])
  const { note, written } = writtenBy(boardKey, writes)
  const touches = (op) => op.relation === name || (op.kind === 'relation' && op.name === full)
  const edges = useMemo(() => pendingValue(saved, ops, previewOps, written, touches), [saved, ops, previewOps]) // eslint-disable-line react-hooks/exhaustive-deps
  const [placed, setPlacedState] = useState(() => placedOn.get(boardKey) ?? [])
  const setPlaced = (list) => {
    if (list.length) placedOn.set(boardKey, list)
    else placedOn.delete(boardKey)
    setPlacedState(list)
  }
  const [highlight, setHighlight] = useState(null)
  const [active, setActive] = useState(null)
  const [overriding, setOverriding] = useState(() => overridesIt(content, namespace, 'relation', full))
  const editable = own || overriding
  const locked = !editable || applying
  const ends = endpointsOf(edges, placed)
  const links = useMemo(() => edges.map((edge) => ({ ...edge, source: 'course' })), [edges])
  const requires = useMemo(() => new Map(ends.map((id) => [id, edges.filter(({ to }) => to === id).map(({ from }) => from)])), [ends, edges])
  const board = useMemo(() => wiringBoard(ends, [], requires, links), [ends, requires, links])
  const titleOf = (id) => {
    if (id.startsWith('#')) return L(tagByRef(content, kind, id)?.title)
    const value = content.registries?.[kind]?.[id]
    return L(value?.title ?? value?.name)
  }
  const describe = (id) => `${shownName(namespace, id)} ${titleOf(id) ?? ''}`.trim()
  const wire = edges.find((edge) => linkKey(edge) === highlight)
  const reset = () => setHighlight(null)
  // One edit, one operation: the board's edges as they are now written back whole.
  const write = (next) => {
    const list = own ? writeEdges(namespace, name, relation, next) : relationOverrideOps(content, namespace, full, next)
    note(list, next, edges)
    if (list.length) onOps(list)
  }
  // Why a wire from → to may not be made (the board marks the ends a wire in hand may go to by it).
  const refuse = (from, to) => {
    const problem = relation.kind !== 'replaces' ? wiringRefusal(requires, from, to)
      : from === to ? 'self' : edges.some((edge) => edge.from === from && edge.to === to) ? 'duplicate' : null
    return problem ? refusal(problem) : null
  }
  const connect = (from, to) => {
    if (locked) return
    write(withEdge(edges, from, to))
    setActive(null)
    setHighlight(linkKey({ from, to }))
  }
  // A wire comes off at once, as on the circuit board; undo puts it back.
  const removeWire = (edge = wire) => {
    if (!edge || locked) return
    write(withoutEdge(edges, linkKey(edge)))
    if (linkKey(edge) === highlight) reset()
  }
  const removeEnd = (id = active) => {
    if (!id || locked) return
    setPlaced(placed.filter((p) => p !== id))
    if (edges.some(({ from, to }) => from === id || to === id)) write(withoutEndpoint(edges, id))
    if (id === active) setActive(null)
    if (wire && (wire.from === id || wire.to === id)) reset()
  }
  const remove = () => {
    if (!own || pending || !confirmDelete(shownName(namespace, full))) return
    placedOn.delete(boardKey)
    onEdit({ op: 'relation.remove', relation: name })
    onSelect(null)
  }
  const candidates = tagCandidates(content, kind).filter((id) => !ends.includes(id))
    .map((id) => ({ value: id, label: shownName(namespace, id), title: titleOf(id) }))
  return (
    <article className="arrange relation-board">
      <div className="arrange-group">
        <code className="editor-id">{shownName(namespace, full)}</code>
        <SourceMark content={content} kind="relation" full={full} own={own} overriding={overriding} pending={pending} onOverride={() => setOverriding(true)} />
        {editable && candidates.length > 0 && <Picker options={candidates} icon={Plus} label={tr('放上板', 'Place on the board')} placeholder={tr('放上板', 'Place on the board')}
          onPick={(id) => setPlaced([...placed, id])} />}
        {own && <button type="button" className="kit-btn editor-tool" disabled={pending} onClick={remove} title={tr('删掉这份关系', 'Remove the relation')}><Trash2 size={14} /></button>}
      </div>
      {/* What is picked, in a row of a fixed height; taking it off is the board's (its × buttons, Delete). */}
      <div className="arrange-actions">
        {wire ? <>
          <strong title={`${describe(wire.from)} → ${describe(wire.to)}`}><code>{shownName(namespace, wire.from)}</code> → <code>{shownName(namespace, wire.to)}</code></strong>
          {relation.kind === 'requires' && <label title={tr('须通过这个前置', 'Require a pass on this prerequisite')}>
            <input type="checkbox" checked={wire.required ?? false} disabled={locked} onChange={(e) => write(withRequired(edges, highlight, e.target.checked))} />
            {tr('须通过', 'Must pass')}
          </label>}
        </> : active ? <strong title={describe(active)}>{describe(active)}</strong> : null}
      </div>
      <ArrangementBoard board={board} idOf={(id) => shownName(namespace, id)} titleOf={titleOf} describe={describe} active={active} wire={highlight} pending={locked} isExternal={() => false} refuse={refuse}
        onLevel={(id) => { reset(); setActive(active === id ? null : id) }} onWire={(edge) => {
          setActive(null)
          setHighlight(linkKey(edge))
          const k = (relation.edges ?? []).findIndex((e) => linkKey(e) === linkKey(edge))
          onPick?.(k < 0 ? ['sequence'] : ['edges', k])
        }}
        onConnect={connect} onDelete={removeWire} onRemoveCard={editable ? removeEnd : null}
        removeCardLabel={tr('从板上拿掉', 'Take off the board')} onCancel={() => { reset(); setActive(null) }} />
    </article>
  )
}
