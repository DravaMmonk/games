import { T } from '../shell/i18n.js'
// The override audit (games/design/README.md 6.1, 6.7): every override a layer can see — its own and those of the packages it
// loads on — listed in the left column, one row each: what was overridden and by which layer. The one picked is in the
// middle with the fields before and after, a way to the object it overrides and, for the layer's own, a way to take it
// back; its file is on the right (Inspector.jsx).
import { editorForType } from './editors.js'
import { useMemo, useState } from 'react'
import { ArrowUpRight, Layers, RotateCcw } from 'lucide-react'
import { L, tr } from '../shell/i18n.js'
import { fieldDiff } from './diff.js'
import { DiffFields } from './DiffView.jsx'
import { confirmDelete } from './delete.js'
import { overrideKey } from './left-lists.js'
import { sidebarSearch } from './sidebar-list.js'
import SidebarListTools from './SidebarListTools.jsx'

const KINDS = { level: [T("关卡", {}, "override-audit")], entry: [T("词条", {}, "override-audit")], tag: [T("标签", {}, "override-audit")], relation: [T("关系", {}, "override-audit")], layout: [T("布局")], i18n: [T("文案")] }
const kindWord = (kind) => L(editorForType(kind)?.name ?? KINDS[kind] ?? kind)
const FILTERS = [['all', T("全部")], ['own', T("本层")], ['below', T("依赖的包")]]

/** The overrides visible from `layer`, in load order: its own and those of every layer it loads on. */
export function visibleOverrides(content, layer) {
  const seen = new Set()
  const visit = (id) => { if (seen.has(id)) return; seen.add(id); for (const dep of content?.layerUses?.[id] ?? []) visit(dep) }
  visit(layer)
  const order = content?.layerOrder ?? []
  return (content?.overrideHistory ?? []).filter((event) => seen.has(event.layer)).sort((a, b) => order.indexOf(a.layer) - order.indexOf(b.layer))
}

/** The left list: `events` (visibleOverrides), narrowed to the layer's own or its dependencies' and by a search. */
export function OverrideList({ events, layer, current, onOpen }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const matches = sidebarSearch(query)
  const shown = events.filter((event) => (filter === 'all' || (filter === 'own' ? event.layer === layer : event.layer !== layer)) && matches(event.name, event.layer, kindWord(event.kind)))
  return (
    <nav className="parts-list" aria-label={tr("覆盖")}>
      <SidebarListTools query={query} onQuery={setQuery} sortOptions={FILTERS.map(([value, label]) => ({ value, label: L(label) }))} sort={filter} onSort={setFilter} sortLabel={tr("显示哪些覆盖")} />
      {shown.map((event) => {
        const key = overrideKey(event)
        return (
          <button key={key} type="button" className={`parts-row ${key === current ? 'is-on' : ''}`} aria-current={key === current ? 'true' : undefined} onClick={() => onOpen(key)} title={kindWord(event.kind)}>
            <i className="family-chip"><Layers size={12} aria-hidden="true" /></i>
            <span>{event.name}</span>
            <code>{event.layer}</code>
          </button>
        )
      })}
    </nav>
  )
}

/** The override picked, in the middle: the fields before and after. `onOpen(event)` opens the object overridden. */
export function OverrideDetail({ event, layer, pending, onOpen, onOps }) {
  const rows = useMemo(() => event && fieldDiff(event.before, event.after), [event])
  if (!event) return <article className="arrange" />
  const own = event.layer === layer
  const takeBack = () => {
    if (pending || !confirmDelete(`${event.layer}: ${event.name}`)) return
    onOps([{ op: 'override.remove', layer, kind: event.kind, name: event.name }])
  }
  return (
    <article className="editor is-wide override-audit">
      <header className="arrange-group">
        <small className="override-kind">{kindWord(event.kind)}</small>
        <code className="editor-id is-static">{event.name}</code>
        <span className="override-layer">{event.layer}</span>
        {onOpen && event.kind !== 'i18n' && <button type="button" className="kit-btn editor-tool" title={tr("打开被覆盖的对象")} aria-label={tr("打开被覆盖的对象")} onClick={() => onOpen(event)}><ArrowUpRight size={14} aria-hidden="true" /></button>}
        {own && event.kind !== 'i18n' && <button type="button" className="kit-btn editor-tool" disabled={pending} title={tr("撤掉这个覆盖")} aria-label={tr("撤掉这个覆盖")} onClick={takeBack}><RotateCcw size={14} aria-hidden="true" /></button>}
      </header>
      <DiffFields rows={rows} />
    </article>
  )
}
