import { T as catalogText } from 'kernel/words'
import { useLayoutEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { FormulaText, L, Popover } from 'kernel/view'
import { tr } from 'kernel/words'
import TreeEditor from './TreeEditor.jsx'

// A single value or list of values edited as trees. A language supplies the chips, serialization and display.
function TreeBox({ anchor, start, build, title, scope, onWhole, onTree, onClose }) {
  const [tree, setTree] = useState(start)
  const change = (next) => {
    setTree(next)
    onTree?.(next)
    if (build.ready(next)) onWhole(build.write(next))
  }
  return (
    <Popover anchor={anchor} title={title} onClose={onClose}>
      <div className="ks-tree-box">
        <TreeEditor tree={tree} onChange={change} chips={build.chips} language={build.language} scope={scope} />
      </div>
    </Popover>
  )
}

/** One value: a button that shows it and opens the editor; `clearable`, a × beside it empties it again. */
export function TreeButton({ value, onChange, build, title, placeholder, scope, disabled = false, clearable = false }) {
  const [anchor, setAnchor] = useState(null)
  return (
    <>
      <span className="ks-pick-item ks-pick-one">
        <button type="button" className={`ks-pick-sentence ${value ? '' : 'is-empty'}`} aria-expanded={Boolean(anchor)} disabled={disabled} onClick={(event) => setAnchor(event.currentTarget)}>
          {value ? <FormulaText text={build.text(value)} /> : L(placeholder)}
        </button>
        {clearable && value && !disabled && <button type="button" className="ks-pick-drop" onClick={() => onChange('')} aria-label={tr('清空')}><X size={12} /></button>}
      </span>
      {anchor && <TreeBox anchor={anchor} start={value ? build.read(value) : null} build={build} title={L(title)} scope={scope} onWhole={onChange} onClose={() => setAnchor(null)} />}
    </>
  )
}

/** The words that close a row of sentences: `end(n)`, given how many it holds (为真。/均为真。). */
const endOf = (end, n) => (typeof end === 'function' ? end(n) : end)

/**
 * Sentences read in a row, as a rule row reads them (shell/RuleRows.jsx): each in its box, 「；」 between them, the
 * row's last words after the last. `texts`: what each says.
 */
export function SentenceRow({ texts, end }) {
  return (
    <span className="rr-body">
      {texts.map((text, k) => (
        <span key={k} className="rr-item">
          <span className="rr-slot is-read"><FormulaText text={text} /></span>
          {k < texts.length - 1 ? <span className="rr-sep">；</span> : end && <span className="rr-end">{L(endOf(end, texts.length))}</span>}
        </span>
      ))}
    </span>
  )
}

/**
 * A list of values written as a rule row writes its premises: each in its box, opening the editor; + adds one (a
 * blank box first, the editor beside it); clearing one in its editor takes it off once the editor closes. `kept`
 * ones stay as they are; `end` closes the row (a function of how many there are); `blank` is what a box not yet
 * written says.
 */
export function TreeList({ value, onChange, build, title, addLabel, scope, kept = [], end = null, blank = catalogText("未写完") }) {
  const [open, setOpen] = useState(null) // { at, anchor, cleared }: the sentence being built (its index, or value.length for a new one)
  const boxes = useRef({})
  // A sentence being added gets its editor once its blank box is there to point at.
  useLayoutEffect(() => {
    if (open && !open.anchor) setOpen({ ...open, anchor: boxes.current[open.at] })
  }, [open])
  const put = (text) => {
    onChange(open.at === value.length ? [...value, text] : value.map((s, k) => (k === open.at ? text : s)))
    setOpen((now) => ({ ...now, at: now.at === value.length ? value.length : now.at, cleared: false }))
  }
  const close = () => {
    if (open.cleared && open.at < value.length) onChange(value.filter((_, k) => k !== open.at))
    setOpen(null)
  }
  const adding = open?.at === value.length
  const shown = adding ? [...value, null] : value
  return (
    <span className="rr-body">
      {shown.map((s, k) => (
        <span key={k} className="rr-item">
          <button
            type="button"
            ref={(el) => { boxes.current[k] = el }}
            className={`rr-slot ${s === null ? 'is-blank' : ''}`}
            aria-label={s === null ? L(blank) : L(build.text(s))}
            aria-expanded={open?.at === k}
            disabled={s !== null && kept.includes(s)}
            onClick={(event) => setOpen({ at: k, anchor: event.currentTarget, cleared: false })}
          >
            {s === null ? L(blank) : <FormulaText text={build.text(s)} />}
          </button>
          {k < shown.length - 1 ? <span className="rr-sep">；</span> : end && <span className="rr-end">{L(endOf(end, shown.length))}</span>}
        </span>
      ))}
      {!adding && (
        <button type="button" className="rr-add" onClick={() => setOpen({ at: value.length, anchor: null, cleared: false })} aria-label={L(addLabel)}>
          <Plus size={14} />{value.length ? null : L(addLabel)}
        </button>
      )}
      {open?.anchor && (
        <TreeBox key={open.at} anchor={open.anchor} start={value[open.at] ? build.read(value[open.at]) : null} build={build} title={L(title)} scope={`${scope}:${open.at}`}
          onWhole={put} onTree={(tree) => setOpen((now) => now && { ...now, cleared: tree == null })} onClose={close} />
      )}
    </span>
  )
}
