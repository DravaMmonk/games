import { useState } from 'react'
import SidebarListTools from './SidebarListTools.jsx'
import SidebarSection, { useSidebarFolds } from './SidebarSection.jsx'

/** Group the whole list by kind or source, with independent folds for each view. */
export default function SidebarGrouping({ scope, foldKey = 'folded-packages', groupsOf, tools, row, children }) {
  const [by, setBy] = useState('kind')
  const { folded, toggle, setAll } = useSidebarFolds(foldKey, `${scope}/${by}`)
  const filtering = Boolean(tools.query.trim())
  const groups = groupsOf(by).filter(group => group.items.length)
  const keys = groups.map(group => group.id)
  return <>
    <SidebarListTools {...tools} groupings={['kind', 'source']} by={by} onBy={setBy}
      folded={keys.length > 0 && keys.every(key => folded.has(key))}
      onFoldAll={!filtering && keys.length ? fold => setAll(keys, fold) : null} />
    {children}
    {groups.map(({ id, title, items }) => {
      const toggleGroup = () => toggle(id)
      return <SidebarSection key={id} title={title} name={title} collapsed={!filtering && folded.has(id)} onSelect={toggleGroup} onToggle={toggleGroup}>
        {items.map(row)}
      </SidebarSection>
    })}
  </>
}
