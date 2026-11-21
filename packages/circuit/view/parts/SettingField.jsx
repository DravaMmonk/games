import { useId, useState } from 'react'
import { X } from 'lucide-react'
import Choice from "../board/Choice.jsx"

import { FormulaText, NumberField, Popover } from 'kernel/view'

import { L } from "kernel/view"
import { T, tr } from 'kernel/words'

import { iconOf } from "./icons.js"
import { numberText } from 'kernel/view'


// One setting of a part, the same in every game (games/design/README.md 6.8): a part definition names one of the kernel controls
// and the kernel draws it — compact on a desktop card, roomy in a sheet (`roomy`) and on a phone. The value a control
// gives is what parts.json says (../../engine/parts/define.js coerce): a word for a select or buttons, a number for a
// number or a slider, true or false for a toggle, and the values picked in order for a list. Plays can provide
// setting renderers by control type. A custom control uses the domain's widget (`widgets[name]`).
//
//   setting   the setting, resolved (its preset filled in, options worked out)        value    its value now
//   onChange(value)    allowed   the option values the course offers here (null: all)    readOnly   shown only

const stop = (e) => e.stopPropagation()
const optionsOf = (setting, allowed) => setting.options.filter((o) => !allowed || allowed.includes(o.value))

function SingleRule({ options, value, onChange, readOnly, label }) {
  const [anchor, setAnchor] = useState(null)
  const selected = options.find((option) => String(option.value) === value?.[0]) ?? (options.length === 1 ? options[0] : null)
  const text = selected && L(selected.label ?? selected.value)
  if (readOnly || options.length === 1) return text ? <span className="pf-rule-pick pf-rule-fixed"><FormulaText text={text} /></span> : null
  return (
    <>
      <button type="button" className={`pf-rule-pick ${selected ? '' : 'is-empty'}`} aria-label={label} aria-expanded={Boolean(anchor)}
        onPointerDown={stop} onClick={(event) => setAnchor(event.currentTarget)}>
        {selected ? <FormulaText text={text} /> : label}
      </button>
      {anchor && <Popover anchor={anchor} title={label} onClose={() => setAnchor(null)} className="pf-rule-pop">
        <div className="pf-rule-options">
          {options.map((option) => <button key={option.value} type="button" className="pf-rule-option" aria-pressed={option === selected}
            onClick={() => { onChange([option.value]); setAnchor(null) }}>
            <FormulaText text={L(option.label ?? option.value)} />
          </button>)}
        </div>
      </Popover>}
    </>
  )
}

/** The values picked, in order: × takes one off, the menu after them adds one. */
function ListControl({ options, value, onChange, readOnly, label, single }) {
  const kept = (value ?? []).filter((v) => options.some((o) => String(o.value) === v))
  const rest = options.filter((o) => !kept.includes(String(o.value)))
  const labelOf = (v) => L(options.find((o) => String(o.value) === v).label ?? v)
  if (single) return <SingleRule options={options} value={kept} onChange={onChange} readOnly={readOnly} label={label} />
  return (
    <span className="pf-list" role="group" aria-label={label} onPointerDown={stop}>
      {kept.map((v) => (
        <span key={v} className="pf-list-item">
          <code>{labelOf(v)}</code>
          {!readOnly && <button type="button" aria-label={tr("去掉「{value}」", {value: labelOf(v)})} onClick={() => onChange(kept.filter((x) => x !== v))}><X size={12} /></button>}
        </span>
      ))}
      {rest.length > 0 && !readOnly && (
        <select value="" aria-label={label} onChange={(e) => e.target.value && onChange([...kept, e.target.value])}>
          <option value="">＋</option>
          {rest.map((o) => <option key={o.value} value={o.value}>{L(o.label ?? o.value)}</option>)}
        </select>
      )}
    </span>
  )
}

function Control({ setting: s, value, onChange, allowed, readOnly, roomy, phone, widgets, controls, id }) {
  const label = s.label ? L(s.label) : s.about ? L(s.about) : s.key
  const render = controls?.[s.control]
  if (render) return render({ setting: s, value, onChange, readOnly, id })
  switch (s.control) {
    case 'select':
      return (
        <select id={id} value={String(value ?? '')} disabled={readOnly} onPointerDown={stop} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          {!optionsOf(s, allowed).some((o) => String(o.value) === String(value ?? '')) && <option value="">—</option>}
          {optionsOf(s, allowed).map((o) => <option key={o.value} value={o.value} title={o.about ? L(o.about) : undefined}>{L(o.label ?? o.value)}</option>)}
        </select>
      )
    case 'buttons':
      return <Choice label={label} value={String(value)} onChange={onChange} layout={s.layout ?? 'row'} roomy={roomy} disabled={readOnly} options={optionsOf(s, allowed).map((o) => [o.value, o.label ?? o.value, iconOf(o.icon), o.about])} />
    case 'number':
      return <NumberField id={id} label={label} value={value ?? ''} phone={phone} readOnly={readOnly} min={s.min} max={s.max} step={s.step} stepper={s.stepper} onChange={onChange} />
    case 'slider':
      return (
        <span className="pf-slider" onPointerDown={stop}>
          <input id={id} type="range" min={s.min} max={s.max} step={s.step ?? 'any'} value={Number(value)} disabled={readOnly} list={s.marks ? `${id}-marks` : undefined} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
          {s.marks && <datalist id={`${id}-marks`}>{s.marks.map((m) => <option key={m} value={m} />)}</datalist>}
          <output htmlFor={id}>{value}{s.unit ? ` ${L(s.unit)}` : ''}</output>
        </span>
      )
    case 'toggle':
      return (
        <button id={id} type="button" role="switch" className="pf-toggle" aria-checked={Boolean(value)} disabled={readOnly} onPointerDown={stop} onClick={() => onChange(!value)} aria-label={label}>
          <i aria-hidden="true" />
          {(s.on || s.off) && <span>{L(value ? s.on ?? '' : s.off ?? '')}</span>}
        </button>
      )
    case 'list':
      return <ListControl options={optionsOf(s, allowed)} value={value} onChange={onChange} readOnly={readOnly} label={label} single={s.single} />
    case 'tree':
      return <code>{value || '—'}</code>
    case 'custom': {
      const Widget = widgets?.[s.widget]
      return Widget ? <Widget setting={s} params={s.params} value={value} onChange={onChange} readOnly={readOnly} roomy={roomy} phone={phone} /> : null
    }
    default:
      return null
  }
}

/** A setting with its label: beside the control on a card, over it in a sheet. */
export default function SettingField({ setting, value, onChange, allowed = null, readOnly = false, roomy = false, phone = false, widgets, controls }) {
  const id = useId()
  const fixed = readOnly || setting.fixed
  const unit = setting.unit && setting.control === 'number' ? <small className="pf-unit">{L(setting.unit)}</small> : null
  return (
    <div className={`pf-setting is-${setting.control} ${roomy ? 'is-roomy' : ''}`} title={setting.about ? L(setting.about) : undefined} onPointerDown={stop}>
      {setting.label && <label className="pf-label" htmlFor={id}>{L(setting.label)}</label>}
      <span className="pf-control"><Control setting={setting} value={value} onChange={onChange} allowed={allowed} readOnly={fixed} roomy={roomy} phone={phone} widgets={widgets} controls={controls} id={id} />{unit}</span>
      {roomy && setting.about && <small className="pf-about">{L(setting.about)}</small>}
    </div>
  )
}

/** The words for a setting's value: its option's label, a number (rounded as the kit writes numbers) with its unit, the side of a toggle. */
export function valueWords(setting, value) {
  if (setting.control === 'list') {
    const values = Array.isArray(value) && value.length ? value : setting.single && setting.options?.length === 1 ? [setting.options[0].value] : []
    return (setting.single ? values.slice(0, 1) : values).map((v) => L(setting.options?.find((x) => String(x.value) === v)?.label ?? v)).join(' ')
  }
  if (setting.options) {
    const o = setting.options.find((x) => String(x.value) === String(value))
    return o ? L(o.label ?? o.value) : String(value ?? '')
  }
  if (setting.control === 'toggle') return L(value ? setting.on ?? '✓' : setting.off ?? '✗')
  const n = setting.control === 'number' && value !== '' && value !== null ? Number(value) : NaN
  return `${Number.isFinite(n) ? numberText(n) : value ?? ''}${setting.unit ? ` ${L(setting.unit)}` : ''}`
}
