import { Fragment } from 'react'
import { FormulaLabel, Markup } from 'kernel/view'
import "./parts.css"
import { L } from 'kernel/view'

import { facesOf, holesOf, outletsOf, settingsOf } from "../../core/parts.js"
import { numberText } from 'kernel/view'

import { isFixed } from "../../core/board/presets.js"
import { evalSettings, failedCheck, partDesc, shows } from "../../core/parts/define.js"
import SettingField, { formulaOptions, valueWords } from "./SettingField.jsx"

// One face of a defined part (games/design/README.md 6.8): the desktop card's body, the phone tile, or the detail both
// share, as parts/<name>.json's `views` lays it out in blocks (the default where it says nothing). The kernel draws every
// block but the part's value and the domain's widgets, which the domain gives (`defined.value`, `defined.widgets`).
//
//   def       the part, resolved (../../engine/parts/define.js)      face   'card' | 'tile' | 'detail'
//   node, ctx the node and its board (shell/CircuitLevel.jsx ctx)    set(patch, changed)  new settings for the node
//   defined   { ops, value(node, ctx, output, face), widgets?, allowed?(type, key) }: value draws an output's value
//             (output null: the part's, or all its outputs; the domain says what each face shows, null for nothing)
//   blocks    the blocks to draw instead of the face's (a phone tile draws its value and the rest apart)
//   mark(path) → props: what the studio's part page puts on each block and setting to pick it (data-pf…)

export const DEFAULT_VIEWS = {
  card: [{ show: 'settings' }, { show: 'value' }],
  tile: [{ show: 'value' }, { show: 'summary' }],
  detail: [{ show: 'desc' }, { show: 'settings' }, { show: 'value' }],
}

/** A face's blocks: parts/<name>.json's, or the default; the path each has in parts/<name>.json (null for a default one). */
export function blocksOf(def, face) {
  const blocks = facesOf(def)[face]
  return blocks ? blocks.map((b, k) => [b, ['views', face, k]]) : DEFAULT_VIEWS[face].map((b) => [b, null])
}

// How many values of a setting the course offers here: none of a setting it does not hold, whatever its control.
const optionCount = (s, allowed) => (allowed && !allowed.length ? 0 : s.options ? s.options.filter((o) => !allowed || allowed.includes(o.value)).length : Infinity)

/**
 * The settings a node shows, their options worked out on it (a setting's `from`: defined.options(def, setting, node,
 * ctx)): their `when` holds, and the course offers more than one value of an option setting (a list, any).
 */
export function visibleSettings(def, params, defined, node = null, ctx = null) {
  const resolved = (s) => (s.from ? { ...s, options: defined.options?.(def, s, node, ctx) ?? [] } : s)
  return settingsOf(def).map((s) => [resolved(s), s.key]).filter(([s]) => (defined.visible?.(def.type, s.key) ?? true) && shows(s, def, params, defined.ops) && (s.from ? s.options.length > 0 : optionCount(s, defined.allowed?.(def.type, s.key)) > 1))
}

const fmt = (v, digits) => (typeof v === 'number' ? (digits === undefined ? numberText(v) : v.toFixed(digits)) : v === true ? '✓' : v === false ? '✗' : String(v ?? '—'))

export default function PartFace({ def, face, node, ctx, set, defined, phone = false, roomy = false, blocks: given, mark = () => ({}) }) {
  const params = node.params ?? {}
  const readOnly = Boolean(ctx?.readOnly) || !set
  const shown = visibleSettings(def, params, defined, node, ctx)
  const list = given ?? blocksOf(def, face)
  const valueOf = (s) => params[s.key] ?? s.default ?? (s.control === 'list' ? undefined : s.options?.[0]?.value)
  const words = (s) => valueWords(s, valueOf(s))
  const settingLabel = (s) => {
    if (!s.formula) return words(s)
    const options = formulaOptions(s)
    const value = valueOf(s)
    const selected = Array.isArray(value) ? value : []
    const values = s.control === 'list' ? (selected.length ? selected : s.single && options.length === 1 ? [options[0].value] : []) : [value]
    return (s.single ? values.slice(0, 1) : values).flatMap((picked) => {
      const option = options.find((o) => String(o.value) === String(picked))
      return option ? [<FormulaLabel key={option.value} text={option.label ?? option.value} mark={option.mark} />] : []
    })
  }
  const setting = (s, k) => (
    <div key={s.key} className="pf-slot" {...mark(['settings', k])}>
      <SettingField setting={s} value={params[s.key] ?? s.default} allowed={defined.allowed?.(def.type, s.key) ?? null} readOnly={readOnly || isFixed(node, s.key)} roomy={roomy} phone={phone} widgets={defined.widgets} controls={defined.controls} onChange={(v) => set({ [s.key]: v }, s.key)} />
    </div>
  )
  const block = (b, path, key) => {
    // A default block stands for no field of its own; the description's is the part's.
    const at = path ? mark(path) : b.show === 'desc' ? mark(['desc']) : {}
    switch (b.show) {
      case 'value': {
        const v = defined.value(node, ctx, b.output ?? null, face)
        return v ? <div key={key} className="pf-value" {...at}>{v}</div> : null
      }
      case 'settings': {
        const keys = b.keys ? shown.filter(([s]) => b.keys.includes(s.key)) : shown
        return keys.length ? <div key={key} className="pf-settings" {...at}>{keys.map(([s, k]) => setting(s, k))}</div> : null
      }
      case 'setting': {
        const hit = shown.find(([s]) => s.key === b.key)
        if (!hit) return null
        return b.as === 'label' ? <span key={key} className={hit[0].formula ? 'pf-words formula-row' : 'pf-words'} {...at}>{settingLabel(hit[0])}</span> : <div key={key} {...at}>{setting(...hit)}</div>
      }
      case 'summary': {
        const values = b.text ? [L(b.text).replace(/\{([^}]*)\}/g, (_, k) => (def.setting[k] ? words(def.setting[k]) : ''))]
          : shown.flatMap(([s]) => settingLabel(s)).filter(Boolean)
        return values.length ? <span key={key} className={`pf-summary${!b.text && shown.some(([s]) => s.formula) ? ' formula-row' : ''}`} {...at}>{values.map((value, i) => <Fragment key={i}>{i > 0 && ' · '}{value}</Fragment>)}</span> : null
      }
      case 'readout': {
        const v = evalSettings(b.expr, def, params, defined.ops)
        return <span key={key} className="pf-readout" {...at}><span>{L(b.label)}</span><output>{fmt(v, b.digits)}{b.unit ? ` ${L(b.unit)}` : ''}</output></span>
      }
      case 'action': {
        const writes = Object.entries(b.set).filter(([key]) => !isFixed(node, key))
        const next = Object.fromEntries(writes.map(([k, text]) => [k, evalSettings(text, def, params, defined.ops)]))
        const ready = !readOnly && writes.length > 0 && Object.values(next).every((v) => v !== undefined && !(typeof v === 'number' && !Number.isFinite(v))) && (!b.when || Boolean(evalSettings(b.when, def, params, defined.ops)))
        return <button key={key} type="button" className="pf-action" disabled={!ready} onPointerDown={(e) => e.stopPropagation()} onClick={() => set(next, null)} {...at}>{L(b.label)}</button>
      }
      case 'text':
        return <p key={key} className="pf-text" {...at}><Markup text={b.text} /></p>
      case 'desc':
        return <p key={key} className="pf-desc" {...at}><Markup text={partDesc(def, (k) => defined.allowed?.(def.type, k) ?? null)} /></p>
      case 'ports':
        return (
          <dl key={key} className="pf-ports" {...at}>
            {holesOf(def).map((p) => <div key={`in-${p.name}`}><dt><Markup text={p.label ?? p.name} /></dt><dd>{p.about ? L(p.about) : ''}</dd></div>)}
            {outletsOf(def).map((p) => <div key={`out-${p.name}`} className="is-out"><dt><Markup text={p.label ?? p.name} /></dt><dd>{p.about ? L(p.about) : ''}</dd></div>)}
          </dl>
        )
      case 'widget': {
        const Widget = defined.widgets?.[b.widget]
        return Widget ? <div key={key} {...at}><Widget ctx={ctx} params={b.params} settings={params} /></div> : null
      }
      case 'row':
        return <div key={key} className="pf-row" {...at}>{b.blocks.map((x, k) => block(x, path ? [...path, 'blocks', k] : null, k))}</div>
      default:
        return null
    }
  }
  const drawn = list.map(([b, path], k) => block(b, path, k)).filter(Boolean)
  const failed = !list.some(([b]) => b.show === 'value') && face !== 'tile' ? failedCheck(def, params, defined.ops) : null
  if (!drawn.length && !failed) return null
  return <div className={`pf-face is-${face}`}>{drawn}{failed && <p className="pf-check">{L(failed)}</p>}</div>
}
