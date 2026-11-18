import { T } from '../shell/i18n.js'
// The command palette (Ctrl/⌘+K): one box to go anywhere in the game and run any studio action (palette.js ranks
// the items). ↑↓ to choose, Enter to go, Escape to leave. An action that needs a word more (a new level's id) asks for
// it in the same box.
import { useMemo, useState } from 'react'
import { L, tr } from '../shell/i18n.js'
import { useOverlay } from '../shell/useOverlay.js'
import { rankPalette } from './palette.js'
import { useListCursor } from './useListCursor.js'

const KIND = { recent: T("最近"), action: T("操作"), level: T("关卡"), era: T("章"), field: T("字段", {}, "palette"), projected: T("对象"), finding: T("检查", {}, "palette") }
const SHOWN = 80

export default function Palette({ items, onRun, onClose }) {
  const [typed, setTyped] = useState('')
  const [asking, setAsking] = useState(null) // an action waiting for its word
  const overlay = useOverlay(() => {
    if (asking) {
      setAsking(null)
      setTyped('')
    } else onClose()
  })
  const shown = useMemo(() => (asking ? [] : rankPalette(items, typed).slice(0, SHOWN)), [items, typed, asking])
  const run = (item) => {
    if (item.ask && !asking) {
      setAsking(item)
      setTyped(item.ask.value ?? '')
      return
    }
    onClose()
    onRun(item, asking ? typed.trim() : undefined)
  }
  const { at, setAt, list, onKeyDown } = useListCursor(shown, {
    reset: typed,
    onConfirm: (item) => {
      if (asking) {
        if (typed.trim()) run(asking)
      } else if (item) run(item)
    },
  })
  let group = null
  return (
    <div ref={overlay} className="palette-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={tr('命令面板')}>
        <input
          className="palette-input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={onKeyDown} spellCheck={false}
          placeholder={asking ? asking.ask.placeholder : tr('关卡、字段、百科、检查……  > 操作  @ 字段')}
          aria-label={asking ? asking.ask.placeholder : tr('搜索')}
        />
        {asking ? <p className="palette-ask">{asking.label}</p> : <ul className="palette-list" ref={list} role="listbox">
          {shown.map((item, k) => {
            const key = item.file ?? item.kind
            const heading = key !== group ? <li key={`g ${key}`} className="palette-group">{L(item.groupLabel ?? KIND[item.kind])}</li> : null
            group = key
            return [heading, (
              <li key={item.key} role="option" aria-selected={k === at} className={`palette-item is-${item.kind} ${k === at ? 'is-at' : ''}`} onPointerDown={(e) => { e.preventDefault(); run(item) }} onPointerEnter={() => setAt(k)}>
                <span>{L(item.label)}</span>
                {item.detail && <small>{L(item.detail)}</small>}
              </li>
            )]
          })}
        </ul>}
      </div>
    </div>
  )
}
