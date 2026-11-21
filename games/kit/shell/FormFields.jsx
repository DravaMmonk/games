import { L } from './i18n.js'

// The fields of a row's form (RowTable.jsx), the same in every game. Each is a labelled block; values are the game's
// own (sentences, names…), options [{ value, label }] with labels as { zh, en } pairs or strings.

/** A labelled block of a form. */
export function Field({ label, children }) {
  return (
    <div className="ff-field">
      <span className="ff-label">{L(label)}</span>
      {children}
    </div>
  )
}


function ChoiceButtons({ label, value, options, onChange, disabled = false, inline = false }) {
  return (
    <div className={`ff-choice${inline ? ' is-inline' : ''}`} role="radiogroup" aria-label={L(label)}
      onClick={inline ? (event) => event.stopPropagation() : undefined}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'is-on' : ''} disabled={disabled} onClick={() => onChange?.(o.value)}>{L(o.label)}</button>
      ))}
    </div>
  )
}

/** One of a few values, as buttons side by side. */
export function ChoiceField({ label, ...props }) {
  return <Field label={label}><ChoiceButtons label={label} {...props} /></Field>
}

/** The same choices without a visible field label inside a table cell. */
export function InlineChoice(props) {
  return <ChoiceButtons {...props} inline />
}
