import { BookOpen } from 'lucide-react'
import { L, shownName, GroupedList, copyWithoutTextKeys, studio } from "kernel/view"
import { T, tr } from 'kernel/words'

const { freeObjectName, objectValue, ownNames, ownObjectData } = studio

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

/** The encyclopedia's entries, grouped by their tags, the sections or the relations that gather them. */
export function EntryList({ content, namespace, game, at: selection, field, by, onBy, heading, onHeading, newOptions, onNew, onNavigate, onEdit, saving }) {
  const entries = content.glossary?.entries ?? []
  const at = new Map(entries.map((entry, k) => [entry.id, k]))
  const current = selection?.glossary && field?.path?.[0] === 'entries' ? field.path[1] : null
  const selected = entries[current]?.id
  const addOptions = [
    { value: 'blank', label: tr('新建词条') },
    { value: 'copy', label: tr('复制所选词条'), disabled: !selected },
  ]
  const add = action => {
    if (saving) return
    const source = action === 'copy' ? selected : null
    const name = freeObjectName(ownNames(content, 'entry', namespace), source ? source.slice(source.indexOf('/') + 1) : 'entry')
    const data = source ? copyWithoutTextKeys(ownObjectData(namespace, objectValue(content, 'entry', source))) : { title: T('新词条'), body: [] }
    const { id: _, ...rest } = data
    onEdit({ op: 'entry.put', entry: name, data: rest })
    onNavigate('glossary', ['entries', entries.length])
  }
  return (
    <GroupedList kind="entry" content={content} namespace={namespace} game={game} items={entries.map((entry) => entry.id)} label={(id) => L(entries[at.get(id)]?.title)}
      groupings={groupings} by={by} onBy={onBy} heading={heading} onHeading={onHeading} newOptions={newOptions} onNew={onNew}
      addOptions={addOptions} addLabel={tr("词条")} onAdd={add}
      row={(id) => <Row key={id} icon={BookOpen} on={at.get(id) === current} title={L(entries[at.get(id)]?.title)} name={shownName(namespace, id)} onClick={() => onNavigate('glossary', ['entries', at.get(id)])} />} />
  )
}
