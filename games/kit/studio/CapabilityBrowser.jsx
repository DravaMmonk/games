// The kernel's capabilities, read only (games/design/README.md 6.2, 6.7): what a package can pick and combine — value types,
// operations, primitive parts, boards, task kinds, content items, displays, languages, content kinds — each by its
// `<package>/<name>`, grouped in the left column by kind or source; the one picked in the middle, with
// what it says and what it takes; its description as JSON on the right.
import { useState } from 'react'
import { L, tr } from '../shell/i18n.js'
import { sidebarSearch } from './sidebar-list.js'
import { capabilityKey, capabilityOf } from './left-lists.js'
import { localName, namespaceOf } from './objects-edit.js'
import SidebarGrouping from './SidebarGrouping.jsx'
import ListRow from './ListRow.jsx'
import { Cpu } from 'lucide-react'

const kindsOf = (capabilities, definitions) => Object.keys(capabilities ?? {}).sort((a, b) =>
  (definitions?.[a]?.studio.order ?? Infinity) - (definitions?.[b]?.studio.order ?? Infinity) || a.localeCompare(b),
)
const kindLabel = (definitions, kind) => (definitions?.[kind]?.studio.label ? L(definitions[kind].studio.label) : kind)

/** The capability `key` names (left-lists.js capabilityKey), else the first listed: { kind, name, it }, or null. */
export function currentCapability(capabilities, key, definitions) {
  const picked = capabilityOf(key)
  if (picked && capabilities?.[picked.kind]?.[picked.name]) return { ...picked, it: capabilities[picked.kind][picked.name] }
  const kind = kindsOf(capabilities, definitions).find((k) => Object.keys(capabilities?.[k] ?? {}).length)
  if (!kind) return null
  const [name, it] = Object.entries(capabilities[kind])[0]
  return { kind, name, it }
}

/**
 * The left list of capabilities (`capabilities`: { kind: { '<package>/<name>': description } }, the vocabulary's index),
 * grouped by kind or source. `current`: { kind, name } open; `onOpen(kind, name)` opens one.
 */
export function CapabilityList({ capabilities, definitions, namespace, current, onOpen }) {
  const [query, setQuery] = useState('')
  const matches = sidebarSearch(query)
  const groupsOf = by => {
    const groups = new Map()
    for (const kind of kindsOf(capabilities, definitions)) {
      for (const [name, it] of Object.entries(capabilities?.[kind] ?? {})) {
        if (!matches(name, L(it.about))) continue
        const source = namespaceOf(name) ?? 'kernel'
        const id = by === 'kind' ? kind : source
        if (!groups.has(id)) groups.set(id, { id, title: by === 'kind' ? kindLabel(definitions, kind) : source, items: [] })
        groups.get(id).items.push({ kind, name, title: localName(source, name) ?? name })
      }
    }
    const ordered = [...groups.values()]
    return by === 'source' ? ordered.sort((a, b) => a.id.localeCompare(b.id)) : ordered
  }
  return (
    <nav className="parts-list capabilities" aria-label={tr("能力")}>
      <SidebarGrouping scope={namespace} foldKey="folded-capabilities" groupsOf={groupsOf} tools={{ query, onQuery: setQuery }}
        row={({ kind, name, title }) => (
          <ListRow key={capabilityKey(kind, name)} icon={Cpu} title={title} id={name}
            on={current?.kind === kind && current?.name === name} onClick={() => onOpen(kind, name)} />
        )} />
    </nav>
  )
}

/** The capability picked, in the middle: what it says, what it takes and gives. */
export function CapabilityView({ current, onSource }) {
  return <article className="arrange">{current && <CapabilityDetail name={current.name} it={current.it} onSource={onSource} />}</article>
}

function CapabilityDetail({ name, it, onSource }) {
  const ports = (list) => list.map((p) => <li key={p.name}><code>{p.name}</code><span className="capability-type">{p.type}</span>{p.optional && <small>{tr("可不接")}</small>}</li>)
  return (
    <section className="capability-detail" aria-label={name}>
      <h2><code>{name}</code></h2>
      {it.about && <p>{L(it.about)}</p>}
      {onSource && <button className="kit-btn is-label" type="button" onClick={onSource}>{tr("在源码中查找")}</button>}
      {it.args && <><h3>{tr("输入", {}, "capability-browser")}</h3><ul className="capability-ports">{ports(it.args)}</ul></>}
      {it.inputs && <><h3>{tr("输入口")}</h3><ul className="capability-ports">{ports(it.inputs)}</ul></>}
      {(it.returns || it.outputType) && <><h3>{tr("输出")}</h3><p className="capability-type">{it.returns ?? it.outputType}</p></>}
      {it.outputs && <><h3>{tr("输出口")}</h3><ul className="capability-ports">{ports(it.outputs)}</ul></>}
      {it.accepts && <><h3>{tr("也接受")}</h3><p className="capability-type">{it.accepts.join(' · ')}</p></>}
      {it.params?.fields && Object.keys(it.params.fields).length > 0 && <><h3>{tr("参数")}</h3><SchemaFields fields={it.params.fields} /></>}
    </section>
  )
}

/** A schema's fields as a list: name, type (or the kind it names), whether it may be left out, what it is. */
function SchemaFields({ fields, depth = 0 }) {
  return (
    <ul className="capability-fields">
      {Object.entries(fields).map(([key, field]) => (
        <li key={key}>
          <code>{key}</code>
          <span className="capability-type">{typeOf(field)}</span>
          {field.optional && <small>{tr("可选", {}, "capability-browser")}</small>}
          {field.about && <span className="capability-about">{L(field.about)}</span>}
          {depth < 2 && field.fields && <SchemaFields fields={field.fields} depth={depth + 1} />}
          {depth < 2 && field.of?.fields && <SchemaFields fields={field.of.fields} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

const typeOf = (field) => {
  if (!field) return ''
  if (field.kind) return `${field.type} ${field.kind}`
  if (field.type === 'list') return `list ${typeOf(field.of)}`
  if (field.type === 'oneOf' || field.values) return (field.values ?? []).join(' | ') || field.type
  return field.type
}
