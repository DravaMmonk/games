// A build list grouped (games/design/README.md 6.7): its objects under every group that names them (list-groups.js), each
// group folding, its heading row opening the group's own object (a tag, a tray, a relation, a section) in the middle;
// what no group names under the last heading. The tools above, in one row (SidebarListTools.jsx): a new object of the
// list or a new group, a search, the grouping, and every group folded or unfolded.
import { editorForType } from './editors.js'
import { useState } from 'react'
import { L, tr } from '../shell/i18n.js'
import SidebarListTools from './SidebarListTools.jsx'
import SidebarSection, { useSidebarFolds } from './SidebarSection.jsx'
import { groupHierarchy, groupsOf, ungrouped } from './list-groups.js'
import { shownName } from './objects-edit.js'
import { sidebarSearch } from './sidebar-list.js'

const LEFT = '\0rest'

/**
 * `kind` the list's objects (level, part, entry); `items` their full names, in order; `label(id)` what a row is called
 * (searched); `row(id)` draws one; `by`/`onBy` the grouping; `heading` the group open ({ kind, full }), `onHeading`;
 * `newOptions`/`onNew` a new group (SidebarListTools.jsx); `addOptions`/`onAdd` a new object of the list.
 */
export default function GroupedList({ kind, name = null, content, namespace, game, items, label, row, groupings, by, onBy, heading, onHeading, newOptions, onNew, addOptions = [], addLabel, onAdd = () => {}, nestedTags = false }) {
  const [query, setQuery] = useState('')
  const { folded, toggle, setAll } = useSidebarFolds(`folded-${kind}-${by}`, game)
  const matches = sidebarSearch(query)
  const filtering = Boolean(query.trim())
  const known = new Set(items)
  const groups = groupsOf(content, kind, by, { nestedTags }).map((group) => ({ ...group, members: group.members.filter((id) => known.has(id)) }))
  const rest = ungrouped(items, groups)
  const shown = (ids) => ids.filter((id) => matches(id, label(id)))
  const keys = [...groups.map((group) => group.full), LEFT]
  const titleOf = (group) => L(content.registries?.[group.kind]?.[group.full]?.title) || shownName(namespace, group.full)
  const renderGroup = group => {
    const members = shown(group.members)
    const children = group.children?.map(renderGroup).filter(Boolean)
    if (filtering && !members.length && !children?.length) return null
    return (
      <SidebarSection key={group.full} title={titleOf(group)} name={shownName(namespace, group.full)} collapsed={!filtering && folded.has(group.full)}
        active={heading?.kind === group.kind && heading.full === group.full} onSelect={() => onHeading({ kind: group.kind, full: group.full })} onToggle={() => toggle(group.full)}>
        {children}
        {members.map(row)}
      </SidebarSection>
    )
  }
  return (
    <nav className="parts-list" aria-label={tr(...(name ?? editorForType(kind)?.name ?? { level: ['关卡', 'Levels'], entry: ['词条', 'Entries'] }[kind] ?? [kind, kind]))}>
      <SidebarListTools addOptions={addOptions} addLabel={addLabel} onAdd={onAdd} query={query} onQuery={setQuery}
        groupings={groupings} by={by} onBy={onBy} newOptions={newOptions} onNew={onNew}
        folded={keys.every((key) => folded.has(key))} onFoldAll={(fold) => setAll(keys, fold)} />
      {(nestedTags && by === 'tag' ? groupHierarchy(groups) : groups).map(renderGroup)}
      {shown(rest).length > 0 && (
        <SidebarSection key={LEFT} title={tr('未分组', 'Ungrouped')} name="" collapsed={!filtering && folded.has(LEFT)} onToggle={() => toggle(LEFT)}>
          {shown(rest).map(row)}
        </SidebarSection>
      )}
    </nav>
  )
}
