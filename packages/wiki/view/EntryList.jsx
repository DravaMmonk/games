import { BookOpen } from 'lucide-react'
import { L, shownName, GroupedList } from "kernel/view"
import { tr } from 'kernel/words'

export const groupings = ['tag', 'section', 'relation']

/** One row of a list: its icon, what it is called, its name. */
function Row({ icon: Icon, on, title, name, onClick }) {
  return (
    <button type="button" className={`parts-row is-object ${on ? 'is-on' : ''}`} aria-current={on ? 'true' : undefined} onClick={onClick}>
      <i className="family-chip"><Icon size={12} aria-hidden="true" /></i>
      <span>{title || name}</span>
      {title ? <code>{name}</code> : <i />}
    </button>
  )
}

/** The encyclopedia's entries, grouped by their tags, the sections or the relations that gather them. `onOpen(k)` opens the k-th. */
export function EntryList({ content, namespace, game, current, by, onBy, heading, onHeading, newOptions, onNew, onOpen, addOptions = [], onAdd }) {
  const entries = content.glossary?.entries ?? []
  const at = new Map(entries.map((entry, k) => [entry.id, k]))
  return (
    <GroupedList kind="entry" content={content} namespace={namespace} game={game} items={entries.map((entry) => entry.id)} label={(id) => L(entries[at.get(id)]?.title)}
      groupings={groupings} by={by} onBy={onBy} heading={heading} onHeading={onHeading} newOptions={newOptions} onNew={onNew}
      addOptions={addOptions} addLabel={tr("词条")} onAdd={onAdd}
      row={(id) => <Row key={id} icon={BookOpen} on={at.get(id) === current} title={L(entries[at.get(id)]?.title)} name={shownName(namespace, id)} onClick={() => onOpen(at.get(id))} />} />
  )
}
