import { Markup } from 'kernel/view'
import { Boxes, Cpu, LogIn, LogOut, Plus, ShieldCheck, SlidersHorizontal, SquareFunction, Workflow } from 'lucide-react'
import { L } from "kernel/view"
import { T, tr } from 'kernel/words'

import { iconOf } from "./icons.js"
import { settingsOf } from "../../core/parts.js"

// A part's own fields as the studio's part page draws them (games/design/README.md 6.7): each carries its path in the part
// (data-pf); in edit mode a click picks it (picker, on the page around them), and a + adds an item to a list. The fields
// are rows of one list, each named by an icon (its word in the tooltip): what the part takes and gives, its settings,
// what it computes, its rules and checks. A row shows what holds for the part, what its operation brings marked as
// brought (dashed), so a part that writes no ports of its own still shows the ones it has.
// PartSheet shows a built part's independent implementations and settings.
//
//   def   the part as parts/<name>.json writes it      edit   { picked (a path in the part), pick(path), add(path) } or null
//   card  the part as the game compiled it (its ports and settings resolved), where there is one

const at = (path) => JSON.stringify(path)

/** The props that mark an element as the part's field at `path`, and a + that adds an item to the list at `path`. */
export const marker = (edit) => ({
  mark: (path) => ({ 'data-pf': at(path), ...(edit?.picked === at(path) ? { 'data-picked': '' } : {}) }),
  add: (path, label = tr('加一项')) => edit && <button type="button" className="pp-add" title={label} aria-label={label} onClick={(e) => { e.stopPropagation(); edit.add(path) }}><Plus size={12} aria-hidden="true" /></button>,
})

/** In edit mode, a click on a marked element picks its field (a + adds instead). */
export const picker = (edit) => (e) => {
  if (!edit || e.target.closest('.pp-add')) return
  const hit = e.target.closest('[data-pf]')
  if (!hit) return
  e.preventDefault()
  e.stopPropagation()
  edit.pick(JSON.parse(hit.dataset.pf))
}

/** Each row of the sheet: the icon that names it, its word, and what its + says. */
export const ROWS = {
  inputs: [LogIn, T('输入', {}, 'part-sheet'), T('加一个输入', {}, 'part-sheet')],
  outputs: [LogOut, T('输出', {}, 'part-sheet'), T('加一个输出', {}, 'part-sheet')],
  settings: [SlidersHorizontal, T('设置', {}, 'part-sheet'), T('编辑设置', {}, 'part-sheet')],
  inside: [Boxes, T('实现', {}, 'part-sheet'), T('加一个实现', {}, 'part-sheet')],
  card: [Cpu, T('引擎实现', {}, 'part-sheet')],
  op: [SquareFunction, T('运算', {}, 'part-sheet')],
  rules: [Workflow, T('规则', {}, 'part-sheet'), T('加一条规则', {}, 'part-sheet')],
  checks: [ShieldCheck, T('检查', {}, 'part-sheet'), T('加一项检查', {}, 'part-sheet')],
}

/** A row of the sheet: its icon (its word the tooltip and its name), what it holds, and its +. `list`: one item a line;
 *  `empty`: nothing yet, only its + (quieter). */
export function Fact({ row, list = false, empty = false, add = null, children }) {
  const [Icon, word] = ROWS[row]
  const label = L(word)
  return (
    <div className={`pp-fact ${list ? 'is-list' : ''} ${empty ? 'is-empty' : ''}`}>
      <dt><span role="img" title={label} aria-label={label}><Icon size={13} aria-hidden="true" /></span></dt>
      <dd>{children}{add}</dd>
    </div>
  )
}

/** The sheet's rows, one list. */
export const Facts = ({ children }) => <dl className="pp-facts">{children}</dl>

/**
 * A row of chips a list `key` of the part: `entries(key)` its items ({ key, item, path, brought, title }; by default the
 * list as the part writes it), each named by `name`; a + adds one where `adds(key)`. Empty rows show only to edit.
 */
export function Chips({ def, edit, keys, name, entries = (key) => written(def, key), adds = () => true }) {
  const { mark, add } = marker(edit)
  return keys.map((key) => {
    const items = entries(key)
    const adding = Boolean(edit) && adds(key)
    if (!items.length && !adding) return null
    return (
      <Fact key={key} row={key} empty={!items.length} add={adding ? add([key], L(ROWS[key][2])) : null}>
        {items.map((entry) => (
          <span key={entry.key} className={`pp-chip ${entry.brought ? 'is-brought' : ''}`} title={entry.title} {...mark(entry.path)}>{name(entry.item)}</span>
        ))}
      </Fact>
    )
  })
}

/** A list of the part as it writes it: [{ key, item, path }]. */
const written = (def, key) => (Array.isArray(def[key]) ? def[key].map((item, k) => [k, item]) : Object.entries(def[key] ?? {}))
  .map(([k, item]) => ({ key: k, item, path: [key, k] }))

const portName = (p) => (p.label ? <Markup text={p.label} /> : p.name)
const settingName = (s) => (s.label ? L(s.label) : s.key)
const typeName = (type) => String(type ?? '').split('/').at(-1)
const brought = () => tr('来自运算')

/**
 * A primitive's ports, in and out: as it writes them, else as its operation brings them (`card`, compiled); a single
 * output its type. A + adds a port only to a list the part writes or nothing brings.
 */
export function Ports({ def, card = null, edit }) {
  const entries = (key) => {
    if (Array.isArray(def[key])) return def[key].map((port, k) => ({ key: k, item: port, path: [key, k], title: [port.name, port.type].filter(Boolean).join(' : ') }))
    const ports = (card?.[key] ?? []).map((port, k) => ({ key: k, item: port, path: ['op'], brought: true, title: `${[port.name, port.type].filter(Boolean).join(' : ')}\n${brought()}` }))
    const type = def.outputType ?? card?.outputType
    if (key === 'outputs' && !ports.length && type) {
      return [{ key: 'type', item: { name: typeName(type) }, path: def.outputType ? ['outputType'] : ['op'], brought: !def.outputType, title: def.outputType ? type : `${type}\n${brought()}` }]
    }
    return ports
  }
  // A + only where the part writes the list itself, or nothing is brought to it.
  return <Chips def={def} edit={edit} keys={['inputs', 'outputs']} name={portName} entries={entries} adds={(key) => Array.isArray(def[key]) || !entries(key).some((entry) => entry.brought)} />
}

/** A part's settings, every one that holds (the faces draw only those a player can move); the ones it narrows its own. */
export function Settings({ def, card = null, edit }) {
  const own = (key) => Array.isArray(def.settings) || Boolean(def.settings?.[key])
  const entries = () => (card?.settings ?? settingsOf(def)).map((setting) => ({
    key: setting.key, item: setting, path: ['settings', setting.key], brought: !own(setting.key),
    title: [setting.key, setting.control].filter(Boolean).join(' · ') + (own(setting.key) ? '' : `\n${brought()}`),
  }))
  return <Chips def={def} edit={edit} keys={['settings']} name={settingName} entries={entries} />
}

/** A built part's named implementations. */
export function Implementations({ def, edit }) {
  return <Chips def={def} edit={edit} keys={['inside']} name={(ref) => (
    <><code>{ref.id}</code>{ref.form && ref.form !== ref.id && <span>{ref.form}</span>}{ref.label && <small>{L(ref.label)}</small>}</>
  )} />
}

/** A part's icon and name over what it does: the faces every part has. */
export function Named({ def, edit }) {
  const { mark } = marker(edit)
  const Icon = iconOf(def.icon ?? 'CircuitBoard')
  return (
    <>
      <header className="pp-sheet-head">
        {Icon && <i className="family-chip" data-family={def.family} {...mark([def.icon ? 'icon' : 'family'])}><Icon size={13} aria-hidden="true" /></i>}
        <h3 {...mark(['name'])}>{L(def.name)}</h3>
      </header>
      <p className="pf-desc" {...mark(['desc'])}><Markup text={def.desc} /></p>
    </>
  )
}

export default function PartSheet({ def, edit }) {
  const { mark } = marker(edit)
  return (
    <div className={`pp-sheet ${edit ? 'is-editing' : ''}`}>
      <Named def={def} edit={edit} />
      <Facts>
        <Implementations def={def} edit={edit} />
        {def.card && <Fact row="card"><code className="pp-op" {...mark(['card'])}>{def.card}</code></Fact>}
        <Settings def={def} edit={edit} />
      </Facts>
    </div>
  )
}
