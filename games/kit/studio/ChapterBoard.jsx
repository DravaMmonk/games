// The arrange workspace's chapter board (games/design/README.md 2, 6.7): one chapter of the course, in three tabs. Levels
// are imported from the bar (a level or a level tag, with what they need) whatever the tab.
//
// Order: its levels — an ordered list, the play order — one numbered column, reordered by dragging or Alt+↑/↓ and
// taken out; each change is at once an operation of the changeset, shown before the preview comes back. Links: the chapter's levels on the wiring board with the prerequisites the packages' relations give them; a level
// picked can be marked optional or skippable (the game's level tags). Map: the chapter's own `rows` (MapEditor.jsx),
// those the map's rules give (../course.js mapRows) until it has its own; each move is at once an operation of the
// changeset, shown before the preview comes back (pending-view.js), beside the chapter as the player's map draws it
// (MapPreview.jsx).
import { useMemo, useState } from 'react'
import { GripVertical, Play, RotateCcw, X } from 'lucide-react'
import { eraLevels, mapRows } from '../course.js'
import { L, tr } from '../shell/i18n.js'
import { Picker } from './Picker.jsx'
import ArrangementBoard from './ArrangementBoard.jsx'
import { linkKey, wiringBoard, wiringRefusal } from './arrangement.js'
import MapEditor from './MapEditor.jsx'
import CopyTable from './CopyTable.jsx'
import MapPreview from './MapPreview.jsx'
import { pendingValue, writtenBy } from './pending-view.js'
import { addEdgeOps, removeEdgeOps, tagOverrideOps } from './override-edit.js'
import { usePref } from './prefs.js'
import { objectsOf, tagByRef, tagKey, tagMembers, tagName } from './objects-edit.js'
import { chapterName, chapterOrderRefusal, chapterSet, chapterUnset, importLevels } from './course-edit.js'
import { reordered } from './list-order.js'
import { useDragOrder } from './useDragOrder.js'

const MODES = [['order', '顺序', 'Order'], ['links', '依赖', 'Links'], ['map', '路线图', 'Map']]

/**
 * `course`: the authored chapters; `content`: as it plays. `ops`:
 * the pending changeset; `previewOps`: the operations the content was previewed with; `applying`: being written.
 */
export default function ChapterBoard({ content, course, e, at, pending, ops = [], previewOps = [], applying = false, vocabulary = null, names = null, places = [], onSelect, onEdit, onOps, onPlay = null }) {
  const [mode, setMode] = usePref('chapter-mode', 'links')
  const chapter = course.chapters[e]
  const played = content.eras?.[e]
  const titleOf = (id) => {
    if (id.startsWith('#')) return L(tagByRef(content, 'level', id)?.title)
    return L(content.registries?.level?.[id]?.title)
  }
  const describe = (id) => `${id} ${titleOf(id) ?? ''}`.trim()
  // The levels shown: the board's own last change still pending, else the chapter's levels as the preview has them.
  const name = chapterName(chapter.id)
  const { note, written } = writtenBy(`${content.id}|${chapter.id}|levels`, orderWrites)
  const touches = (op) => op.chapter === name && (op.op === 'chapter.put' || ((op.op === 'chapter.set' || op.op === 'chapter.unset') && op.path?.[0] === 'levels'))
  const savedMembers = chapter.levels ?? []
  const members = useMemo(() => pendingValue(savedMembers, ops, previewOps, written, touches), [savedMembers, ops, previewOps]) // eslint-disable-line react-hooks/exhaustive-deps
  const placedIds = useMemo(() => new Set((content.eras ?? []).flatMap(eraLevels)), [content])
  const additions = [
    ...objectsOf(content, 'tag', null).filter(([full, tag]) => tag.kind === 'level' && tagMembers(content, full).some((id) => !placedIds.has(id)))
      .map(([full, tag]) => ({ value: `#${tagName(full)}`, label: `#${tagName(full)}`, title: tag.title, group: tr('关卡标签', 'Level tags') })),
    ...Object.entries(content.registries?.level ?? {}).filter(([id]) => !placedIds.has(id))
      .map(([id, level]) => ({ value: id, label: id, title: level.title, group: tr('关卡', 'Levels') })),
  ]
  const [refusal, setRefusal] = useState(null)
  // One change, one operation: undo takes back one move.
  const setMembers = (next) => {
    if (applying) return
    setRefusal(null)
    const op = chapterSet(chapter.id, ['levels'], next)
    note([op], next, members)
    onOps([op])
  }
  // The chapter's levels are its play order: a move that puts a level before its prerequisite is refused.
  const reorder = (id, to) => {
    const next = reordered(members, [id], to)
    const refused = chapterOrderRefusal(content, next)
    if (refused) setRefusal(refused)
    else setMembers(next)
  }
  const { item } = useDragOrder({ ids: members, disabled: applying, onMove: reorder })
  const importing = (value) => {
    try { setMembers(importLevels(content, members, value, placedIds)) } catch (error) { setRefusal(error.message) }
  }
  return (
    <article className="arrange">
      <header className="arrange-bar">
        <nav className="studio-modes" role="tablist" aria-label={tr('视图', 'View')}>
          {MODES.map(([id, zh, en]) => <button key={id} type="button" role="tab" aria-selected={mode === id} className={`studio-tab ${mode === id ? 'is-on' : ''}`} onClick={() => setMode(id)}>{tr(zh, en)}</button>)}
        </nav>
      </header>
      {refusal && <p className="is-error package-refusal" role="alert">{refusal}</p>}
      {mode === 'order' && <>
        <div className="chapter-order-tools">
          <Picker options={additions} disabled={applying || !additions.length} add label={tr('放进这一章', 'Put in this chapter')} placeholder={additions.length ? tr('放进这一章：关卡或关卡标签', 'Put in this chapter: a level or a level tag') : tr('没有可放进的关卡', 'No level left to put in')}
            onPick={(value) => !applying && importing(value)} />
        </div>
        <ol className="chapter-members is-column" aria-label={tr('这一章的关，按玩的顺序', 'The chapter’s levels, in play order')}>
          {members.map((id, k) => (
            <li key={id} className={`${id.startsWith('#') ? 'is-tag' : ''} ${at?.level === id ? 'is-on' : ''}`} {...item(id)} tabIndex={applying ? undefined : 0}
              onClick={(event) => { if (!event.target.closest('button')) onSelect({ era: e, level: id }) }} aria-current={at?.level === id ? 'true' : undefined}>
              <GripVertical size={12} aria-hidden="true" className="member-grip" />
              <b className="member-no">{k + 1}</b>
              <span>{titleOf(id) || id}</span>
              <code>{id}</code>
              {onPlay && !id.startsWith('#') && <button type="button" className="kit-btn editor-tool" title={tr('从这一关试玩', 'Play from this level')} aria-label={tr('从这一关试玩', 'Play from this level')}
                onClick={() => onPlay(id)}><Play size={12} aria-hidden="true" /></button>}
              <button type="button" className="kit-btn editor-tool" disabled={applying} title={tr('移出这一章', 'Take out of the chapter')}
                onClick={() => setMembers(members.filter((m) => m !== id))}><X size={12} /></button>
            </li>
          ))}
        </ol>
        {/* The level picked: its texts as this game writes them (a game overrides a level's texts only: text.override). */}
        {vocabulary && members.includes(at?.level) && content.levels.some((level) => level.id === at.level) && (
          <section className="chapter-level-texts">
            <h3>{tr(`${titleOf(at.level) || at.level} 在这款游戏里的文字`, `${titleOf(at.level) || at.level}: its texts in this game`)}</h3>
            <p className="arrange-note">{tr('改动写成这款游戏自己的写法（覆盖包里的），清空一格就回到包里的写法。', 'An edit is this game’s own wording (overriding the package’s); emptying a cell goes back to the package’s.')}</p>
            <CopyTable side="game" content={content} vocabulary={vocabulary} scope="all" setScope={() => {}} file={`levels/${at.level.slice(at.level.indexOf('/') + 1)}.json`}
              order={eraLevels(played ?? { levels: [] })} names={names} places={places} onEdit={onEdit} onJump={() => {}} />
          </section>
        )}
      </>}
      {played && mode !== 'order' && (mode === 'map'
        ? <ChapterMap content={content} chapter={chapter} played={played} e={e} at={at} ops={ops} previewOps={previewOps} applying={applying} titleOf={titleOf} onSelect={onSelect} onOps={onOps} />
        : <ChapterLinks content={content} played={played} e={e} at={at} pending={pending} titleOf={titleOf} describe={describe} onSelect={onSelect} onOps={onOps} levelMarks={vocabulary?.levelMarks} />)}
    </article>
  )
}

const refusal = (reason) => ({
  self: tr('关卡不能接到自己。', 'A level cannot depend on itself.'),
  duplicate: tr('这条连线已存在。', 'This wire already exists.'),
  cycle: tr('这条连线会形成循环依赖。', 'This wire would create a cycle.'),
  nowhere: tr('包里没有能放这条先修的关系。', 'No package relation can take this prerequisite.'),
  tagged: tr('这条先修来自标签，要在包里改。', 'This prerequisite comes through a tag: change it in the package.'),
})[reason]

function ChapterLinks({ content, played, e, at, pending, titleOf, describe, onSelect, onOps, levelMarks = {} }) {
  const ids = useMemo(() => eraLevels(played), [played])
  const links = useMemo(() => (played.links ?? []).filter((link) => !link.fromGame).map((link) => ({ ...link, source: 'course' })), [played])
  const requires = useMemo(() => new Map(ids.map((id) => [id, links.filter(({ to }) => to === id).map(({ from }) => from)])), [ids, links])
  const board = useMemo(() => wiringBoard(ids, [], requires, links), [ids, requires, links])
  const [highlight, setHighlight] = useState(null)
  const layer = `@${content.id}`
  const selected = ids.includes(at?.level) ? at.level : null
  const wire = links.find((link) => linkKey(link) === highlight)
  const reset = () => setHighlight(null)
  // Why a wire from → to may not be made (the board marks the ends a wire in hand may go to by it); a wire no package
  // relation can take is said when it is tried.
  const refuse = (from, to) => {
    const problem = wiringRefusal(requires, from, to)
    return problem ? refusal(problem) : null
  }
  const connect = (from, to) => {
    if (pending) return null
    const ops = addEdgeOps(content, layer, from, to)
    if (!ops) return refusal('nowhere')
    onOps(ops)
    setHighlight(linkKey({ from, to }))
    return null
  }
  // A wire comes off at once, as on the circuit board: the pending operation can be taken back (⌘Z).
  const removeWire = (edge = wire) => {
    if (!edge || pending) return null
    const ops = removeEdgeOps(content, layer, edge.from, edge.to)
    if (!ops) return refusal('tagged')
    onOps(ops)
    if (linkKey(edge) === highlight) reset()
    return null
  }
  const mark = (name, on) => {
    const key = tagKey('level', name)
    const now = tagMembers(content, key)
    const next = on ? [...now, selected] : now.filter(id => id !== selected)
    onOps(tagOverrideOps(content, layer, key, next))
  }
  const entry = played.levels.find(({ id }) => id === selected)
  const badges = (id) => {
    const own = played.levels.find((level) => level.id === id)
    return own?.optional || own?.skippable ? <>{own?.optional && <small>{tr('可选', 'Optional')}</small>}{own?.skippable && <small>{tr('可跳过', 'Skippable')}</small>}</> : null
  }
  return (
    <div className="arrange-links">
      <div className="arrange-actions">
        {wire ? <strong title={`${describe(wire.from)} → ${describe(wire.to)}`}>{describe(wire.from)} → {describe(wire.to)}</strong> : entry ? <>
            <strong>{describe(selected)}</strong>
            {levelMarks.optional && <label><input type="checkbox" checked={Boolean(entry.optional)} disabled={pending} onChange={(ev) => mark(levelMarks.optional, ev.target.checked)} />{tr('可选', 'Optional')}</label>}
            {levelMarks.skippable && <label><input type="checkbox" checked={Boolean(entry.skippable)} disabled={pending} onChange={(ev) => mark(levelMarks.skippable, ev.target.checked)} />{tr('可跳过', 'Skippable')}</label>}
          </> : null}
      </div>
      <ArrangementBoard board={board} titleOf={titleOf} badges={badges} describe={describe} active={selected} wire={highlight} pending={pending} isExternal={(id) => !ids.includes(id)} refuse={refuse}
        onLevel={(id) => { reset(); onSelect({ era: e, level: id }) }} onWire={(edge) => setHighlight(linkKey(edge))}
        onConnect={connect} onDelete={removeWire} onCancel={reset} />
    </div>
  )
}

// What each move on a route map, and each change of a chapter's levels, wrote (pending-view.js writtenBy).
const mapWrites = new WeakMap()
const orderWrites = new WeakMap()

function ChapterMap({ content, chapter, played, e, at, ops, previewOps, applying, titleOf, onSelect, onOps }) {
  const ids = useMemo(() => eraLevels(played), [played])
  const local = useMemo(() => new Map(ids.map((id) => [id, (played.links ?? []).filter(({ to, fromGame }) => to === id && !fromGame).map(({ from }) => from).filter((from) => ids.includes(from))])), [ids, played])
  const edges = useMemo(() => [...local].flatMap(([to, froms]) => froms.map((from) => ({ from, to }))), [local])
  const ruled = useMemo(() => mapRows(ids, local, null).rows, [ids, local])
  // The rows shown: the map's own last move still pending, else the chapter's rows as the preview has them.
  const name = chapterName(chapter.id)
  const { note, written } = writtenBy(`${content.id}|${chapter.id}`, mapWrites)
  const touches = (op) => op.chapter === name && (op.op === 'chapter.put' || ((op.op === 'chapter.set' || op.op === 'chapter.unset') && op.path?.[0] === 'rows'))
  const saved = Array.isArray(chapter.rows) ? chapter.rows : null
  const rows = useMemo(() => pendingValue(saved, ops, previewOps, written, touches), [saved, ops, previewOps]) // eslint-disable-line react-hooks/exhaustive-deps
  const own = rows !== null
  // The preview's content changes for the map when it is previewed with other operations than this map's moves (its
  // rows come apart); the game is made again only then.
  const stamp = useMemo(() => JSON.stringify([content.id, (previewOps ?? []).filter((op) => !written(op))]), [content.id, previewOps]) // eslint-disable-line react-hooks/exhaustive-deps
  // One move, one operation: undo takes back one move.
  const write = (op, next) => {
    note([op], next, rows)
    onOps([op])
  }
  return (
    <div className="map-layout map-with-preview">
      <div className="map-edit">
        {own && <div className="arrange-actions">
          <button type="button" className="kit-btn is-label" disabled={applying} onClick={() => write(chapterUnset({ ...chapter, rows }, 'rows'), null)}>
            <RotateCcw size={13} aria-hidden="true" />{tr('按规则排', 'By the rules')}
          </button>
        </div>}
        <MapEditor rows={own ? rows : ruled} members={ids} edges={edges} titleOf={titleOf} pending={applying}
          onRows={(next) => write(chapterSet(chapter.id, ['rows'], next), next)}
          onPick={(id) => onSelect({ era: e, level: id })} picked={at?.level} />
      </div>
      <MapPreview content={content} stamp={stamp} chapter={e} rows={rows} />
    </div>
  )
}
