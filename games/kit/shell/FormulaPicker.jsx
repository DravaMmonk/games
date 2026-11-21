import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { FormulaLabel } from './FormulaText.jsx'
import { L } from './i18n.js'
import Popover from './Popover.jsx'

/** A choice whose labels are formulas. A native select can only show their plain text. */
export default function FormulaPicker({ id, label, options, value, onChange, readOnly = false, placeholder = '—', className = '' }) {
  const [anchor, setAnchor] = useState(null)
  const selected = options.find((option) => String(option.value) === value)
  const selectedText = selected && L(selected.label ?? selected.value)
  const optionText = (option) => [option.mark, L(option.label ?? option.value)].filter(Boolean).join(' ')
  const close = () => setAnchor(null)
  const move = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const index = buttons.indexOf(event.target)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + buttons.length + (event.key === 'ArrowDown' ? 1 : -1)) % buttons.length
    event.preventDefault()
    buttons[next]?.focus()
  }
  if (readOnly) return selectedText ? <span className={`formula-row formula-pick is-fixed ${className}`}><FormulaLabel text={selectedText} mark={selected.mark} /></span> : null
  return (
    <>
      <button id={id} type="button" className={`formula-row formula-pick ${className}`} aria-label={selectedText ? `${label} · ${optionText(selected)}` : label}
        aria-haspopup="dialog" aria-expanded={Boolean(anchor)} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => setAnchor(event.currentTarget)}
        onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setAnchor(event.currentTarget) } }}>
        <span>{selected ? <FormulaLabel text={selectedText} mark={selected.mark} /> : placeholder}</span><ChevronsUpDown size={12} aria-hidden="true" />
      </button>
      {anchor && <Popover anchor={anchor} title={label} className="formula-pop" initialFocus=".formula-option" onClose={close}>
        <div className="formula-options" onKeyDown={move}>
          {options.map((option) => <button key={option.value} type="button" className="formula-row formula-option" aria-pressed={option === selected}
            aria-label={optionText(option)} title={option.about ? L(option.about) : undefined}
            onClick={() => { onChange(option.value); close(); anchor.focus({ preventScroll: true }) }}>
            <FormulaLabel text={option.label ?? option.value} mark={option.mark} />
          </button>)}
        </div>
      </Popover>}
    </>
  )
}
