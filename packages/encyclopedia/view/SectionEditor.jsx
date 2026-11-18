import { useState } from 'react'
import { L, tr, tagByRef, tagName, shownName, localName, namespaceOf, overridesIt, gatherWriter, withoutId, confirmDelete, GatherHead, Members, Picker } from 'kernel/view'

/** The section `full`: its entries, and the order the encyclopedia shows them in. */
export function SectionEditor({ content, namespace, full, pending, onSelect, onEdit, onOps, onPick }) {
  const value = content?.registries?.section?.[full]
  const [overriding, setOverriding] = useState(() => overridesIt(content, namespace, 'section', full))
  if (!value) return <article className="arrange" />
  const own = namespaceOf(full) === namespace
  const editable = own || overriding
  const locked = pending || !editable
  const write = gatherWriter({ kind: 'section', full, namespace, own, value: withoutId(value), content, onEdit, onOps })
  const entries = content.registries?.entry ?? {}
  const titleOf = (ref) => (ref.startsWith('#') ? L(tagByRef(content, 'entry', ref)?.title) : L(entries[ref]?.title)) ?? ''
  const refs = value.values ?? []
  const candidates = [
    ...Object.keys(entries).filter((id) => !refs.includes(id)).map((id) => ({ value: id, label: shownName(namespace, id), title: titleOf(id), group: tr('词条', 'Entries') })),
    ...Object.entries(content.registries?.tag ?? {}).filter(([name, tag]) => tag.kind === 'entry' && !refs.includes(`#${tagName(name)}`)).map(([name]) => ({ value: `#${tagName(name)}`, label: shownName(namespace, `#${name}`), title: titleOf(`#${name}`), group: tr('标签', 'Tags') })),
  ]
  const remove = () => {
    if (!own || pending || !confirmDelete(shownName(namespace, full))) return
    onEdit({ op: 'section.remove', section: localName(namespace, full) })
    onSelect(null)
  }
  return (
    <article className="arrange gather-editor">
      <GatherHead kind="section" full={full} value={value} own={own} overriding={overriding} setOverriding={setOverriding} content={content} namespace={namespace} pending={pending} write={write} onRemove={remove} onPick={onPick} />
      <section className="gather-part" onClick={() => onPick?.(['values'])}>
        <h3>{tr('词条', 'Entries')}</h3>
        <Members refs={refs} titleOf={titleOf} namespace={namespace} locked={locked} onChange={(values) => write.set('values', values)} />
        {!locked && <Picker options={candidates} add label={tr('加入', 'Add')} placeholder={tr('加入', 'Add')} onPick={(ref) => write.set('values', [...refs, ref])} />}
      </section>
    </article>
  )
}
