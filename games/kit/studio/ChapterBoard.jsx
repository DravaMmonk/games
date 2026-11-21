import { T } from '../shell/i18n.js'
// The chapter editor shares one player preview between the ordered list and the route map.
import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Play, RotateCcw, X } from 'lucide-react'
import { eraLevels, mapRows } from '../course.js'
import { L, tr } from '../shell/i18n.js'
import { Picker } from './Picker.jsx'
import { projectWires, wiringRefusal } from './arrangement.js'
import MapEditor from './MapEditor.jsx'
import CopyTable from './CopyTable.jsx'
import MapPreview from './MapPreview.jsx'
import { pendingValue, writtenBy } from './pending-view.js'
import { addEdgeOps, removeEdgeOps, tagOverrideOps } from './override-edit.js'
import { usePref } from './prefs.js'
import { objectsOf, tagByRef, tagKey, tagMembers, tagName } from './objects-edit.js'
import { chapterName, chapterSet, chapterUnsetRows, courseOrderRefusal, earlierPrerequisites, importLevels } from './course-edit.js'
import { reordered, shifted } from './list-order.js'
import { useDragOrder } from './useDragOrder.js'
import { routeMove } from './course-impact.js'
import { wiringLayoutRefusal } from './layout-edit.js'
import { isMapRowsEdit, mapWiringContent, noteMapWires } from './map-wiring.js'

const MODES = [['order', T("顺序")], ['map', T("路线图")]]

/**
 * `course`: the authored chapters; `content`: as it plays. `ops`:
 * the pending changeset; `previewOps`: the operations the content was previewed with; `applying`: being written.
 */
export default function ChapterBoard({ content, course, e, at, pending, ops = [], previewOps = [], revision, applying = false, vocabulary = null, names = null, places = [], onSelect, onEdit, onOps, onPlay = null, onReorderLevels, onRemoveLevel, onRouteImpact }) {
  const [mode, setMode] = usePref('chapter-view', 'map')
  const previewBeforeApply = useRef(null)
  if (applying) previewBeforeApply.current = { content, firstOp: ops[0] }
  // A successful apply clears the queue before the preview of the newly written files arrives.
  const wiringPaused = applying || (content === previewBeforeApply.current?.content && ops[0] !== previewBeforeApply.current.firstOp)
  const chapter = course.chapters[e]
  const played = content.eras?.[e]
  const titleOf = (id) => {
    if (id.startsWith('#')) return L(tagByRef(content, 'level', id)?.title)
    return L(content.registries?.level?.[id]?.title)
  }
  // The levels shown: the board's own last change still pending, else the chapter's levels as the preview has them.
  const name = chapterName(chapter.id)
  const { note, written } = writtenBy(`${content.id}|${chapter.id}|levels`, orderWrites)
  const touches = (op) => op.chapter === name && (op.op === 'chapter.put' || ((op.op === 'chapter.set' || op.op === 'chapter.unset') && op.path?.[0] === 'levels'))
  const savedMembers = chapter.levels ?? []
  const members = useMemo(() => pendingValue(savedMembers, ops, previewOps, written, touches), [savedMembers, ops, previewOps]) // eslint-disable-line react-hooks/exhaustive-deps
  const placedIds = useMemo(() => new Set((content.eras ?? []).flatMap(eraLevels)), [content])
  const additions = [
    ...objectsOf(content, 'tag', null).filter(([full, tag]) => tag.kind === 'level' && tagMembers(content, full).some((id) => !placedIds.has(id)))
      .map(([full, tag]) => ({ value: `#${tagName(full)}`, label: `#${tagName(full)}`, title: tag.title, group: tr("关卡标签") })),
    ...Object.entries(content.registries?.level ?? {}).filter(([id]) => !placedIds.has(id))
      .map(([id, level]) => ({ value: id, label: id, title: level.title, group: tr("关卡") })),
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
  // The chapter's levels are its play order, after the chapters before it: a change that puts a level before its
  // prerequisite, here or in a later chapter, is refused (one already so is no refusal).
  const courseWith = (levels) => (content.eras ?? []).map((era, k) => (k === e ? { id: era.id, levels } : era))
  const changeMembers = (next) => {
    const refused = courseOrderRefusal(content, courseWith(next), courseWith(members))
    if (refused) setRefusal(refused)
    else setMembers(next)
  }
  const reorder = (id, to) => onReorderLevels(reordered(members, [id], to))
  const { item } = useDragOrder({ ids: members, disabled: pending, onMove: reorder })
  const importing = (value) => {
    try { changeMembers(importLevels(content, members, value, placedIds)) } catch (error) { setRefusal(error.message) }
  }
  const map = writtenBy(`${content.id}|${chapter.id}`, mapWrites)
  const savedRows = Array.isArray(chapter.rows) ? chapter.rows : null
  const touchesRows = (op) => op.chapter === name && (op.op === 'chapter.put' || ((op.op === 'chapter.set' || op.op === 'chapter.unset') && op.path?.[0] === 'rows'))
  const rows = pendingValue(savedRows, ops, previewOps, map.written, touchesRows)
  const marks = vocabulary?.levelMarks
  const projected = useMemo(() => wiringPaused ? null : mapWiringContent(content, ops, previewOps, marks?.optional), [content, ops, previewOps, wiringPaused, marks?.optional])
  const wiringContent = projected ?? content
  // Layout edits only change geometry. A new saved revision always refreshes runtime metadata.
  const stamp = JSON.stringify([content.id, revision, previewOps.filter((op) => !isMapRowsEdit(op))])
  const noteRows = (op, next) => map.note([op], next, rows)
  const writeRows = (op, next) => {
    noteRows(op, next)
    onOps([op])
  }
  return (
    <article className="arrange">
      <header className="arrange-bar">
        <nav className="studio-modes" role="tablist" aria-label={tr("视图")}>
          {MODES.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={mode === id} className={`studio-tab ${mode === id ? 'is-on' : ''}`} onClick={() => setMode(id)}>{L(label)}</button>)}
        </nav>
      </header>
      {refusal && <p className="is-error package-refusal" role="alert">{refusal}</p>}
      <div className="effect-layout">
        {mode === 'order' && <div className="chapter-order">
          <div className="chapter-order-tools">
            <Picker options={additions} disabled={applying || !additions.length} add label={tr("放进这一章")} placeholder={additions.length ? tr("放进这一章：关卡或关卡标签") : tr("没有可放进的关卡")}
              onPick={(value) => !applying && importing(value)} />
          </div>
          <ol className="chapter-members is-column" aria-label={tr("这一章的关，按玩的顺序")}>
            {members.map((id, k) => (
              <li key={id} className={`${id.startsWith('#') ? 'is-tag' : ''} ${at?.level === id ? 'is-on' : ''}`} {...item(id)} tabIndex={applying ? undefined : 0}
                onClick={(event) => { if (!event.target.closest('button')) onSelect({ era: e, level: id }) }} aria-current={at?.level === id ? 'true' : undefined}>
                <GripVertical size={12} aria-hidden="true" className="member-grip" />
                <b className="member-no">{k + 1}</b>
                <span>{titleOf(id) || id}</span>
                <code>{id}</code>
                {at?.level === id && [[-1, ArrowUp, tr("上移")], [1, ArrowDown, tr("下移")]].map(([by, Icon, label]) => (
                  <button key={by} type="button" className="kit-btn editor-tool" disabled={pending || k + by < 0 || k + by >= members.length}
                    title={label} aria-label={label} onClick={() => onReorderLevels(shifted(members, id, by))}><Icon size={12} aria-hidden="true" /></button>
                ))}
                {onPlay && !id.startsWith('#') && <button type="button" className="kit-btn editor-tool" title={tr("从这一关试玩")} aria-label={tr("从这一关试玩")}
                  onClick={() => onPlay(id)}><Play size={12} aria-hidden="true" /></button>}
                <button type="button" className="kit-btn editor-tool" disabled={pending} title={tr("从课程移出关卡")}
                  onClick={() => onRemoveLevel(id)}><X size={12} /></button>
              </li>
            ))}
          </ol>
          {/* The level picked: its texts as this game writes them (a game overrides a level's texts only: text.override). */}
          {vocabulary && members.includes(at?.level) && content.levels.some((level) => level.id === at.level) && (
            <section className="chapter-level-texts">
              <h3>{tr("{level} 在这款游戏里的文字", {level: titleOf(at.level) || at.level})}</h3>
              <p className="arrange-note">{tr("改动写成这款游戏自己的写法（覆盖包里的），清空一格就回到包里的写法。")}</p>
              <CopyTable side="game" content={content} vocabulary={vocabulary} scope="all" setScope={() => {}} file={`levels/${at.level.slice(at.level.indexOf('/') + 1)}.json`}
                order={eraLevels(played ?? { levels: [] })} names={names} places={places} onEdit={onEdit} onJump={() => {}} />
            </section>
          )}
        </div>}
        {played && mode === 'map' && <ChapterMap key={chapter.id} content={content} wiringContent={wiringContent} wiringPending={!projected} chapter={chapter} played={played} e={e} at={at}
          rows={rows} pending={pending} applying={applying} ops={ops} titleOf={titleOf} onSelect={onSelect} onWrite={writeRows} noteRows={noteRows} vocabulary={vocabulary} onRouteImpact={onRouteImpact}
          onOps={onOps} onRefuse={setRefusal} levelMarks={marks} />}
        {played && <MapPreview content={content} stamp={stamp} chapter={played.id} rows={rows} edges={wiringContent.relationEdges.requires} />}
      </div>
    </article>
  )
}

const refusal = (reason) => ({
  self: tr("关卡不能接到自己。"),
  duplicate: tr("这条连线已存在。"),
  cycle: tr("这条连线会形成循环依赖。"),
  nowhere: tr("包里没有能放这条先修的关系。"),
  tagged: tr("这条先修来自标签，要在包里改。"),
})[reason]

// What each move on a route map, and each change of a chapter's levels, wrote (pending-view.js writtenBy).
const mapWrites = new WeakMap()
const orderWrites = new WeakMap()

function ChapterMap({ content, wiringContent, wiringPending, chapter, played, e, at, rows, pending, applying, ops, titleOf, onSelect, onWrite, noteRows, vocabulary, onRouteImpact, onOps, onRefuse, levelMarks = {} }) {
  const ids = useMemo(() => eraLevels(played), [played])
  const courseEdges = wiringContent.relationEdges?.requires ?? []
  const links = useMemo(() => projectWires(courseEdges.filter(({ to }) => ids.includes(to)).map(({ game, ...edge }) => ({
    ...edge, ...(game && { fromGame: game }), source: game ? 'external' : 'course',
  }))), [courseEdges, ids])
  const local = useMemo(() => new Map(ids.map((id) => [id, links.filter(({ to, from }) => to === id && ids.includes(from)).map(({ from }) => from)])), [ids, links])
  const ruled = useMemo(() => mapRows(ids, local).rows, [ids, local])
  const requires = useMemo(() => {
    const graph = new Map()
    for (const { from, to, game } of courseEdges) if (!game) graph.set(to, [...(graph.get(to) ?? []), from])
    return graph
  }, [courseEdges])
  const layoutEdges = useMemo(() => courseEdges.filter((edge) => !edge.game), [courseEdges])
  const positions = new Map(ids.map((id, index) => [id, index]))
  const external = useMemo(() => new Map(links.filter(({ from }) => !ids.includes(from)).map((link) => [link.from, link])), [links, ids])
  const describe = (id) => {
    const link = external.get(id)
    if (link?.fromGame) return `${link.fromGame} · ${link.fromLevel}`
    return `${id} ${titleOf(id) ?? ''}`.trim()
  }
  const refuse = (from, to) => {
    const problem = wiringRefusal(requires, from, to)
    if (problem) return refusal(problem)
    if (positions.has(from) && positions.get(from) >= positions.get(to)) return tr("请先在「顺序」中把前置关卡排在后续关卡之前。")
    const bad = rows && wiringLayoutRefusal(rows, layoutEdges, { from, to })
    return bad ? tr("{value} 是 {value2} 的前置，须排在它上面的行。", {value: describe(bad.from), value2: describe(bad.to)}) : null
  }
  const layer = `@${content.id}`
  const relationContent = { ...wiringContent, registries: { ...content.registries, relation: wiringContent.relations } }
  const writeWires = (changes) => {
    noteMapWires(relationContent, ops, changes)
    onOps(changes)
  }
  const connect = (from, to) => {
    const changes = addEdgeOps(relationContent, layer, from, to)
    if (!changes) return refusal('nowhere')
    writeWires(changes)
    return null
  }
  const remove = ({ from, to, fromGame }) => {
    if (fromGame) return tr("跨游戏依赖在包的关系编辑器中修改。")
    const changes = removeEdgeOps(relationContent, layer, from, to)
    if (!changes) return refusal('tagged')
    writeWires(changes)
    return null
  }
  const moveRows = (next) => {
    const before = rows ?? ruled
    const op = chapterSet(chapter.id, ['rows'], next)
    const plan = routeMove(wiringContent, vocabulary, before, next)
    if (!plan.removed.length && !plan.blocked.length) {
      onWrite(op, next)
      return
    }
    onRouteImpact(plan, [...plan.ops, op], () => {
      noteMapWires(relationContent, ops, plan.ops)
      noteRows(op, next)
    })
  }
  const selected = played.levels.find(({ id }) => id === at?.level)
  // A prerequisite from another chapter is picked from the chapters before this one; it then shows at the map's top.
  const earlier = useMemo(() => !selected ? [] : earlierPrerequisites(wiringContent, e, selected.id).map(({ id, chapter: k }) => ({
    value: id, label: id, title: content.registries?.level?.[id]?.title,
    group: `${k + 1} · ${L(content.eras[k].title ?? content.eras[k].chapter?.title) ?? chapterName(content.eras[k].id)}`,
  })), [content, wiringContent, e, selected])
  const addEarlier = (from) => onRefuse(refuse(from, selected.id) ?? connect(from, selected.id))
  const mark = (name, on) => {
    const key = tagKey('level', name)
    const now = tagMembers(content, key)
    const next = on ? [...now, selected.id] : now.filter((id) => id !== selected.id)
    onOps(tagOverrideOps(content, layer, key, next))
  }

  return (
    <div className="map-layout">
      <div className="arrange-actions">
        {rows !== null && <button type="button" className="kit-btn is-label" disabled={applying} onClick={() => onWrite(chapterUnsetRows(chapter.id), null)}>
          <RotateCcw size={13} aria-hidden="true" />{tr("按规则排")}
        </button>}
        {selected && <>
          <Picker options={earlier} disabled={wiringPending || !earlier.length} add label={tr("加前面章节的前置")}
            placeholder={earlier.length ? tr("加前面章节的前置") : tr("前面的章没有可加的前置")} onPick={(value) => !wiringPending && addEarlier(value)} />
          {levelMarks.optional && <label><input type="checkbox" checked={Boolean(selected.optional)} disabled={pending} onChange={(event) => mark(levelMarks.optional, event.target.checked)} />{tr("可选", {}, "chapter-board")}</label>}
          {levelMarks.skippable && <label><input type="checkbox" checked={Boolean(selected.skippable)} disabled={pending} onChange={(event) => mark(levelMarks.skippable, event.target.checked)} />{tr("可跳过")}</label>}
        </>}
      </div>
      <MapEditor rows={rows ?? ruled} members={ids} links={links} external={external}
        titleOf={titleOf} describe={describe} selected={selected?.id} pending={applying || wiringPending} wiringPending={wiringPending}
        refuse={refuse} onConnect={connect} onDelete={remove}
        onMove={moveRows} onRows={(next) => onWrite(chapterSet(chapter.id, ['rows'], next), next)}
        onPick={(id) => onSelect({ era: e, level: id })} />
    </div>
  )
}
