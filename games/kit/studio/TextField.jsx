// A text as an author writes it, growing with what it holds, edited where it is shown: the field reads as the text
// until it is pointed at or focused; Enter or leaving the field writes it (one operation for the whole edit, empty
// included: in the copy table an empty cell goes back to the package's text), Shift+Enter breaks the line, Escape puts
// back the text shown. A link
// (<level-ref>, <part-ref>, <wiki-ref>, ../shell/refs.js) shows as a chip with the name it will show in the game, and
// is put in from a picker that searches the game's levels, parts and entries, never typed as a tag: opened by 🔗, by
// Ctrl/⌘+L (a selection becomes the search and is replaced by the link) or by typing [[ (【【 from a Chinese keyboard);
// the links the other language has and this one lacks come first. Link targets are checked
// as the text is edited (../engine/text.js).
//
//   <TextField value onSet names compact? />   onSet(text): the text written in the selected language; compact: the findings
//                                                    a count on the text, listed while it is being edited
//   names: the reference catalog assembled from the registered groups.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link2 } from 'lucide-react'
import { getLang, L, sideOf, tr } from '../shell/i18n.js'
import { REF, referenceTag, refProblems } from '../engine/text.js'
import { OptionList } from './Picker.jsx'
import { MOD } from './Shortcuts.jsx'
import { textIn } from '../engine/i18n.js'

const TRIGGERS = ['[[', '【【']

function chipText(names, kind, id, lang) {
  const item = names?.byKind[kind]?.get(id)
  return item ? [item.label !== item.id && item.label, sideOf(item.title, lang)].filter(Boolean).join(' ') : null
}

/* ---------- a side as DOM: text nodes and chips; and back ---------- */

function chip(kind, id, names, lang) {
  const span = document.createElement('span')
  const text = chipText(names, kind, id, lang)
  span.className = `ref-chip is-${kind} ${text ? '' : 'is-missing'}`
  span.contentEditable = 'false'
  span.dataset.ref = kind
  span.dataset.to = id
  span.textContent = text || tr('引用不可用')
  return span
}

function draw(el, value, names, lang) {
  el.textContent = ''
  let at = 0
  for (const m of value.matchAll(REF)) {
    if (m.index > at) el.append(value.slice(at, m.index))
    el.append(chip(m[1], m[2], names, lang))
    at = m.index + m[0].length
  }
  if (at < value.length) el.append(value.slice(at))
}

/** The text a node stands for: text as it is, a chip as its tag, a line break as \n. */
function textOf(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/​/g, '')
  if (node.dataset?.ref) return referenceTag(node.dataset.ref, node.dataset.to)
  if (node.nodeName === 'BR') return '\n'
  const inner = [...node.childNodes].map(textOf).join('')
  return ['DIV', 'P'].includes(node.nodeName) && node.previousSibling ? `\n${inner}` : inner
}
const serialize = (el) => [...el.childNodes].map(textOf).join('')

/** Where a point (container, offset) is, counted in the text the side stands for. */
function offsetOf(el, container, offset) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.setEnd(container, offset)
  const box = document.createElement('div')
  box.append(range.cloneContents())
  return serialize(box).length
}

/** The selection in a side as [start, end], counted as offsetOf counts; null when it is elsewhere. */
function spanOf(el) {
  const sel = window.getSelection()
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return null
  const r = sel.getRangeAt(0)
  return [offsetOf(el, r.startContainer, r.startOffset), offsetOf(el, r.endContainer, r.endOffset)]
}

/** A range's start or end put at `n`, counted as offsetOf counts (never inside a chip). */
function setPoint(el, range, n, end) {
  let left = n
  for (const node of el.childNodes) {
    const size = textOf(node).length
    if (left <= size) {
      if (node.nodeType === Node.TEXT_NODE) end ? range.setEnd(node, left) : range.setStart(node, left)
      else if (left === 0) end ? range.setEndBefore(node) : range.setStartBefore(node)
      else end ? range.setEndAfter(node) : range.setStartAfter(node)
      return
    }
    left -= size
  }
  end ? range.setEnd(el, el.childNodes.length) : range.setStart(el, el.childNodes.length)
}

/** The selection put back at [start, end]. */
function placeSpan(el, start, end = start) {
  const range = document.createRange()
  setPoint(el, range, start, false)
  setPoint(el, range, end, true)
  select(range)
}
const select = (range) => {
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

/**
 * One side: editable text with chips. `api` gets insert(kind, id), to put a link over the selection it last had, and
 * focus(), to go back to it; onLink(query) asks for the link picker.
 */
function Side({ value, onChange, names, lang, label, placeholder, api, onFocus, onLink, onCommit, onCancel }) {
  const el = useRef(null)
  const composing = useRef(false)
  const drawn = useRef(null)
  const saved = useRef(null) // the selection when the side last lost focus
  const keep = () => { saved.current = spanOf(el.current) ?? saved.current }
  // Drawn again only when the text is not what the side shows already (typing never redraws it under the caret).
  useLayoutEffect(() => {
    if (drawn.current?.names === names && drawn.current?.lang === lang && serialize(el.current) === value) return
    // Drawn again under the caret (a title typed renames its chips): the selection stays where it was.
    const span = document.activeElement === el.current ? spanOf(el.current) : null
    draw(el.current, value, names, lang)
    if (span) placeSpan(el.current, ...span)
    drawn.current = { names, lang }
  }, [value, names, lang])

  const changed = () => {
    if (composing.current) return
    let text = serialize(el.current)
    const caret = spanOf(el.current)?.[1] ?? null
    // [[ just typed asks for a link there, and goes.
    const trigger = caret !== null && TRIGGERS.includes(text.slice(caret - 2, caret))
    if (trigger) text = text.slice(0, caret - 2) + text.slice(caret)
    // A tag typed or pasted as text becomes its chip.
    if (trigger || [...el.current.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && !n.nodeValue.matchAll(REF).next().done)) {
      draw(el.current, text, names, lang)
      if (caret !== null) placeSpan(el.current, trigger ? caret - 2 : caret)
      text = serialize(el.current)
    }
    onChange(text)
    if (trigger) {
      keep()
      onLink('')
    }
  }
  api.current = {
    insert(kind, id) {
      api.current.focus()
      const range = window.getSelection().getRangeAt(0)
      const c = chip(kind, id, names, lang)
      range.deleteContents()
      range.insertNode(c)
      range.setStartAfter(c)
      range.collapse(true)
      select(range)
      changed()
      keep()
    },
    focus() {
      const node = el.current
      node.focus()
      const end = serialize(node).length
      placeSpan(node, ...(saved.current ?? [end, end]))
    },
  }
  return (
    <div
      ref={el} className="rich" lang={lang} role="textbox" aria-multiline="true" aria-label={label} aria-placeholder={placeholder} data-placeholder={placeholder} contentEditable suppressContentEditableWarning spellCheck
      onInput={changed}
      onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={() => { composing.current = false; changed() }}
      onFocus={onFocus}
      onBlur={keep}
      onKeyUp={keep}
      onMouseUp={keep}
      onPaste={(e) => {
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      }}
      onKeyDown={(e) => {
        if (composing.current || e.nativeEvent.isComposing) return
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault()
          document.execCommand('insertLineBreak')
        } else if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          ;(e.key === 'Enter' ? onCommit : onCancel)()
          el.current.blur()
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
          e.preventDefault()
          keep()
          const picked = window.getSelection().getRangeAt(0).cloneContents()
          onLink(picked.querySelector('[data-ref]') ? '' : picked.textContent.trim())
        }
      }}
      onClick={(e) => {
        const ref = e.target.closest?.('.ref-chip')
        if (ref && ref.dataset.ref === 'level' && (e.metaKey || e.ctrlKey)) names?.onLevel?.(ref.dataset.to)
      }}
    />
  )
}

export function textFindings(pair, names) {
  if (!names) return []
  return [...new Set(refProblems(pair, '', names.byKind).map((problem) => problem.trim()))]
}

export function TextField({ value, onSet, label, names, findings = [], compact = false, lang = getLang(), placeholder, onFocus, onBlur }) {
  const text = textIn(value, lang)
  // The text being typed, kept here until it is written and while the operation it makes is on its way back; a text
  // that changes elsewhere (an undo) shows unless it is being edited.
  const [draft, setDraft] = useState(text)
  const pending = useRef(null)
  const editing = useRef(false)
  const done = useRef(false) // written or put back by a key: leaving the field then writes nothing more
  useEffect(() => {
    if (editing.current) return
    if (pending.current === null || pending.current === text) {
      pending.current = null
      setDraft(text)
    }
  }, [text])
  const box = useRef(null)
  const tools = useRef(null)
  const [linking, setLinking] = useState(null) // the picker's first search while it is open
  const latest = useRef(draft)
  latest.current = draft
  const commit = useCallback(() => {
    const next = latest.current
    if (next === text) return
    pending.current = next
    onSet(next)
  }, [onSet, text])
  // A field taken away while it is being edited (another object picked by a key) writes what it holds.
  const unmounting = useRef(commit)
  unmounting.current = () => { if (editing.current && !done.current) commit() }
  useEffect(() => () => unmounting.current(), [])
  const keyed = (write) => () => {
    done.current = true
    editing.current = false
    if (write) commit()
    else setDraft(text)
  }
  const pickerOpen = linking !== null
  const options = useMemo(() => pickerOpen
    ? (names?.options ?? []).map(option => ({ ...option, group: L(option.group) }))
    : [], [names, pickerOpen, lang])
  const close = () => { setLinking(null); box.current?.focus() }
  const all = [...new Set([...textFindings({ [lang]: draft }, names), ...findings])]
  return (
    <div onFocus={(event) => { editing.current = true; done.current = false; onFocus?.(event) }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        if (!done.current) commit()
        pending.current = null
        editing.current = false
        done.current = false
        setLinking(null)
      }
      onBlur?.(event)
    }} className={`field-text ${all.length ? 'has-findings' : ''} ${compact ? 'is-compact' : ''}`}>
      <Side value={draft} onChange={setDraft} names={names} lang={lang} label={label} placeholder={placeholder} api={box} onLink={setLinking}
        onCommit={keyed(true)} onCancel={keyed(false)} />
      {names && (
        <div className="text-tools" ref={tools}>
          <button type="button" className="text-link" onPointerDown={(e) => e.preventDefault()} onClick={() => setLinking(linking === null ? '' : null)} aria-label={tr('插入链接')} title={tr("插入链接（{MOD}+L 或 [[）", {MOD})}><Link2 size={13} aria-hidden="true" /></button>
          {linking !== null && (
            <OptionList
              options={options} value={null} query={linking} anchor={tools} onClose={close} onOutside={() => setLinking(null)}
              onPick={(v) => {
                setLinking(null)
                const [kind, ...id] = v.split(':')
                box.current?.insert(kind, id.join(':'))
              }}
            />
          )}
        </div>
      )}
      {compact && all.length > 0 && <i className="text-mark" title={all.join('\n')}>{all.length}</i>}
      {all.length > 0 && <ul className="field-findings">{all.map((f) => <li key={f}>{f}</li>)}</ul>}
    </div>
  )
}
