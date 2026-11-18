// The kernel's capabilities, read only (games/DESIGN.md 6.2, 6.7): what a package can pick and combine — value types,
// operations, primitive parts, boards, task kinds, content items, displays, languages, content kinds — each by its
// `<package>/<name>`, listed in the left column narrowed by kind, module and a search; the one picked in the middle, with
// what it says and what it takes; its description as JSON on the right.
import { useMemo, useState } from 'react'
import { L, tr } from '../shell/i18n.js'
import { sidebarSearch } from './sidebar-list.js'
import { capabilityOf } from './left-lists.js'
import SidebarListTools from './SidebarListTools.jsx'
import ListRow from './ListRow.jsx'
import { Cpu } from 'lucide-react'

const KINDS = [
  ['operation', '运算', 'Operations'], ['primitive', '原始元件', 'Primitive parts'], ['valueType', '值类型', 'Value types'],
  ['board', '板', 'Boards'], ['kind', '任务种类', 'Task kinds'], ['play', '玩法', 'Plays'],
  ['mode', '模式', 'Modes'], ['want', '目标条件', 'Goals'], ['display', '显示', 'Displays'], ['language', '语言', 'Languages'],
  ['family', '元件族', 'Families'], ['mark', '图记', 'Marks'], ['widget', '控件', 'Widgets'],
  ['view', '视图', 'Views'], ['picture', '图片', 'Pictures'], ['scene', '场景', 'Scenes'],
  ['target', '目标', 'Targets'], ['constraint', '约束', 'Constraints'], ['benchModel', '实验模型', 'Bench models'],
  ['unlock', '解锁项', 'Unlocks'], ['world', '世界', 'Worlds'], ['robot', '机器人', 'Robots'],
  ['figure', '图示', 'Figures'], ['condition', '条件', 'Conditions'], ['trace', '轨迹', 'Traces'],
  ['panel', '面板', 'Panels'], ['explain', '讲解', 'Explanations'], ['port', '端口', 'Ports'],
]
const ALL = ''
const kindsOf = capabilities => [...KINDS, ...Object.keys(capabilities ?? {}).filter(kind => !KINDS.some(([key]) => key === kind)).map(kind => [kind, kind, kind])]
export const moduleOf = (name) => name.split('/')[0]

/** The capability `key` names (left-lists.js capabilityKey), else the first listed: { kind, name, it }, or null. */
export function currentCapability(capabilities, key) {
  const picked = capabilityOf(key)
  if (picked && capabilities?.[picked.kind]?.[picked.name]) return { ...picked, it: capabilities[picked.kind][picked.name] }
  const kind = kindsOf(capabilities).map(([k]) => k).find((k) => Object.keys(capabilities?.[k] ?? {}).length)
  if (!kind) return null
  const [name, it] = Object.entries(capabilities[kind])[0]
  return { kind, name, it }
}

/**
 * The left list of capabilities (`capabilities`: { kind: { '<package>/<name>': description } }, the vocabulary's index),
 * narrowed by kind, module and a search. `current`: { kind, name } open; `onOpen(kind, name)` opens one.
 */
export function CapabilityList({ capabilities, current, onOpen }) {
  const kinds = kindsOf(capabilities).filter(([kind]) => Object.keys(capabilities?.[kind] ?? {}).length)
  const [kind, setKind] = useState(current?.kind ?? kinds[0]?.[0] ?? 'operation')
  const [module, setModule] = useState(ALL)
  const [query, setQuery] = useState('')
  const entries = useMemo(() => Object.entries(capabilities?.[kind] ?? {}), [capabilities, kind])
  const modules = useMemo(() => [...new Set(Object.values(capabilities ?? {}).flatMap((of) => Object.keys(of).map(moduleOf)))].sort(), [capabilities])
  const matches = sidebarSearch(query)
  const shown = entries.filter(([name, it]) => (module === ALL || moduleOf(name) === module) && matches(name, L(it.about)))
  return (
    <nav className="parts-list capabilities" aria-label={tr('能力', 'Capabilities')}>
      <SidebarListTools query={query} onQuery={setQuery} choices={[
        { label: tr('能力的种类', 'Kind of capability'), value: kind, onPick: setKind, options: kinds.map(([id, zh, en]) => ({ value: id, label: `${tr(zh, en)} · ${Object.keys(capabilities[id]).length}` })) },
        { label: tr('模块', 'Module'), value: module, onPick: setModule, options: [{ value: ALL, label: tr('全部模块', 'All modules') }, ...modules.map((m) => ({ value: m, label: m }))] },
      ]} />
      <ul className="capabilities-list">
        {shown.map(([name, it]) => {
          const on = current?.kind === kind && current?.name === name
          return (
            <li key={name}>
              <ListRow icon={Cpu} on={on} onClick={() => onOpen(kind, name)} title={it.about ? L(it.about) : name} id={it.about ? name : undefined} />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** The capability picked, in the middle: what it says, what it takes and gives. */
export function CapabilityView({ current }) {
  return <article className="arrange">{current && <CapabilityDetail name={current.name} it={current.it} />}</article>
}

function CapabilityDetail({ name, it }) {
  const ports = (list) => list.map((p) => <li key={p.name}><code>{p.name}</code><span className="capability-type">{p.type}</span>{p.optional && <small>{tr('可不接', 'Optional')}</small>}</li>)
  return (
    <section className="capability-detail" aria-label={name}>
      <h2><code>{name}</code></h2>
      {it.about && <p>{L(it.about)}</p>}
      {it.args && <><h3>{tr('输入', 'Inputs')}</h3><ul className="capability-ports">{ports(it.args)}</ul></>}
      {it.inputs && <><h3>{tr('输入口', 'Inputs')}</h3><ul className="capability-ports">{ports(it.inputs)}</ul></>}
      {(it.returns || it.outputType) && <><h3>{tr('输出', 'Output')}</h3><p className="capability-type">{it.returns ?? it.outputType}</p></>}
      {it.outputs && <><h3>{tr('输出口', 'Outputs')}</h3><ul className="capability-ports">{ports(it.outputs)}</ul></>}
      {it.accepts && <><h3>{tr('也接受', 'Also accepts')}</h3><p className="capability-type">{it.accepts.join(' · ')}</p></>}
      {it.params?.fields && Object.keys(it.params.fields).length > 0 && <><h3>{tr('参数', 'Parameters')}</h3><SchemaFields fields={it.params.fields} /></>}
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
          {field.optional && <small>{tr('可选', 'Optional')}</small>}
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
