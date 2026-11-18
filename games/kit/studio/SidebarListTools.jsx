// The tools of every list in the studio's left column (games/design/README.md 6.7), one row that looks the same whatever the
// list: a new item, a search, the list's view, and every group folded or unfolded. What a list has no use for is
// greyed, never left out, so the row does not change as the lists are switched. Like things go together: one + makes
// or copies an object of the list, or a group of any kind the list can be grouped by (a tag, a tray, a relation, a
// section), each under its category's name; one view menu groups, orders and filters.
import { ArrowDownWideNarrow, ChevronsDownUp, ChevronsUpDown, Plus, Search } from 'lucide-react'
import { tr } from '../shell/i18n.js'
import { editorForType } from './editors.js'
import { Picker } from './Picker.jsx'

export const GROUP_WORDS = { tag: ['标签', 'Tags'], relation: ['关系', 'Relations'], section: ['分组', 'Sections'] }
const NEW_WORDS = { tag: ['新的标签', 'New tag'], relation: ['新的关系', 'New relation'], section: ['新的分组', 'New section'] }
/** A grouping's category, as the menus name it: [zh, en] (标签, 托盘, 关系, 分组). */
export const groupCategory = (id) => editorForType(id)?.group?.name ?? GROUP_WORDS[id] ?? [id, id]
const groupName = (id) => tr(...groupCategory(id))
/** One of a category named in the plural (Trays → tray), for the menus' English. */
export const singular = (en) => String(en).replace(/ies$/, 'y').replace(/s$/, '').toLowerCase()

/**
 * The row. A new item: `addOptions` ([{ value, label, children?, disabled? }]) and `onAdd(value)`, under `addLabel`
 * (the list's type, as a category); a new group: `newOptions` ([{ value, label, group (its category), disabled? }])
 * and `onNew(value)` (null options: one kind, the grouping shown's). The search:
 * `query`, `onQuery` (none: greyed), `invalid`. The view: `groupings`, `by`, `onBy` (what the list is grouped by);
 * `sortOptions`, `sort`, `onSort`, `sortLabel` (the order, or a filter); `choices` ([{ label, options, value, onPick }],
 * more such single choices); `toggles` ([{ value, label, on, group }]) and `onToggle(value)`. The folds: `folded` (every group folded) and `onFoldAll(fold)` (none: greyed).
 */
export default function SidebarListTools({
  addOptions = [], addLabel, onAdd, newOptions = null, onNew = null, by = null,
  query = '', onQuery = null, invalid = false, autoFocus = false,
  groupings = [], onBy, sortOptions = [], sort, onSort, sortLabel, choices = [], toggles = [], onToggle,
  folded = false, onFoldAll = null,
}) {
  const [zh, en] = (by && (editorForType(by)?.group?.createLabel ?? NEW_WORDS[by])) ?? ['新的分组', 'New group']
  const groupWord = tr(zh, en)
  const objectWord = addLabel ?? tr('新的一项', 'New item')
  const groupOptions = !onNew ? [] : (newOptions ?? [{ value: null, label: groupWord }]).map((o) => ({ ...o, value: `group:${o.value ?? ''}`, group: o.group ?? groupWord }))
  const adds = [
    ...addOptions.map((o) => ({ ...o, value: `add:${o.value}`, ...(groupOptions.length && { group: objectWord }) })),
    ...groupOptions,
  ]
  const added = (value) => {
    onQuery?.('')
    if (String(value).startsWith('group:')) onNew(newOptions ? value.slice('group:'.length) : null)
    else onAdd(String(value).startsWith('add:') ? value.slice('add:'.length) : value) // a submenu's value comes as it is
  }
  const usable = adds.some((o) => !o.disabled)
  const views = [
    ...groupings.map((id) => ({ value: `by:${id}`, label: groupName(id), group: tr('分组', 'Group by') })),
    ...sortOptions.map((o) => ({ ...o, value: `sort:${o.value}`, group: sortLabel ?? tr('排序', 'Order') })),
    ...choices.flatMap((c, k) => c.options.map((o) => ({ ...o, value: `choice${k}:${o.value}`, group: c.label }))),
    ...toggles.map((o) => ({ ...o, value: `toggle:${o.value}` })),
  ]
  const checked = [`by:${by}`, `sort:${sort}`, ...choices.map((c, k) => `choice${k}:${c.value}`), ...toggles.filter((o) => o.on).map((o) => `toggle:${o.value}`)]
  const viewed = (value) => {
    const [kind, ...rest] = String(value).split(':')
    const v = rest.join(':')
    if (kind === 'by') onBy(v)
    else if (kind === 'sort') onSort(sortOptions.find((o) => String(o.value) === v)?.value ?? v)
    else if (kind.startsWith('choice')) { const c = choices[Number(kind.slice(6))]; c.onPick(c.options.find((o) => String(o.value) === v)?.value ?? v) }
    else onToggle(v)
  }
  const foldLabel = folded ? tr('全部展开', 'Unfold all') : tr('全部收起', 'Fold all')
  return (
    <div className="sidebar-list-tools">
      <Picker add icon={Plus} searchable={false} options={adds} onPick={added} disabled={!usable}
        label={usable ? tr('新建或复制', 'New or copy') : tr('这个列表不新增', 'Nothing to add to this list')} placeholder={objectWord} />
      <label className={`sidebar-list-search ${onQuery ? '' : 'is-off'} ${invalid ? 'is-bad' : ''}`}>
        <Search size={13} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => onQuery?.(e.target.value)} disabled={!onQuery} autoFocus={autoFocus}
          placeholder={tr('搜索')} aria-label={tr('搜索当前列表', 'Search this list')} spellCheck={false} />
      </label>
      <Picker icon={ArrowDownWideNarrow} searchable={false} options={views} checked={checked} onPick={viewed} disabled={!views.length}
        label={views.length ? tr('分组、排序与筛选', 'Group, order and filter') : tr('这个列表没有视图选项', 'This list has no view options')} />
      <button type="button" className="pick-button is-icon" disabled={!onFoldAll} onClick={() => onFoldAll?.(!folded)} title={foldLabel} aria-label={foldLabel}>
        {folded ? <ChevronsUpDown size={14} aria-hidden="true" /> : <ChevronsDownUp size={14} aria-hidden="true" />}
      </button>
    </div>
  )
}
