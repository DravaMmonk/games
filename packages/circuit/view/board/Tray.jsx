import { usePlainProse } from 'kernel/view'
import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import Glyph from "./Glyph.jsx"
import BoardLabel from './BoardLabel.jsx'
import { L, Sheet } from "kernel/view"
import { tr } from 'kernel/words'

import TrayMenu, { trayItemCount } from "./TrayMenu.jsx"

// The phone's parts tray, the same in every game: tap a part to drop it into the next free slot, or hold and drag
// it onto a slot. Dragging a placed block back onto the tray removes it ([data-trash]). `folded` parts wait behind a
// 「更多」 chip at the end, as in the desktop Palette; with a screen's own panel for them (`panel(place)`), the chip
// opens it in a sheet and a part picked there closes it.
export default function Tray({ items, folded = [], onPick, start, panel = null }) {
  const plain = usePlainProse()
  const [more, setMore] = useState(false)
  const [sheet, setSheet] = useState(false)
  const host = useRef(null)
  // How far the tray's top stands above the bottom of the screen, an open menu's row included (it rises above the
  // tray): the toast (Notice.jsx) sits above it rather than under the row.
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return undefined
    const root = document.documentElement
    const sizes = new ResizeObserver(() => update())
    const update = () => {
      const row = el.querySelector('.tray-menu-row')
      if (row) sizes.observe(row)
      root.style.setProperty('--pb-tray-top', `${Math.max(0, window.innerHeight - (row ?? el).getBoundingClientRect().top)}px`)
    }
    const rows = new MutationObserver(update)
    sizes.observe(el)
    rows.observe(el, { childList: true, subtree: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      sizes.disconnect()
      rows.disconnect()
      window.removeEventListener('resize', update)
      root.style.removeProperty('--pb-tray-top')
    }
  }, [])
  const part = (item) => (
    <button key={item.type} type="button" className={`pb-part ${item.folded ? 'is-folded' : ''} ${item.packed ? 'is-packed' : ''}`} data-tray={item.onPick ? undefined : item.type} data-family={item.family} onClick={item.onPick ?? (() => onPick(item.type))} title={plain(item.desc)}>
      {item.icon && <i className="family-chip"><Glyph icon={item.icon} size={13} /></i>}
      <b><BoardLabel label={L(item.label)} /></b>
      {item.fresh && <em className="pb-new">{tr('新')}</em>}
    </button>
  )
  const entry = (item, hidden = false) => item.children
    ? <TrayMenu key={item.menu} entry={item} className="pb-part" phoneHost={host} renderPart={(child) => part({ ...child, folded: hidden })} />
    : part({ ...item, folded: hidden })
  const count = trayItemCount(folded)
  if (!start && !items.length && !folded.length) return null
  return (
    <div ref={host} className="pb-tray-wrap">
      <section className="pb-tray" data-trash aria-label={tr('元件托盘：点击放入空格，或按住拖到指定格子')}>
        {start && <div className="pb-tray-start">{start}</div>}
        <div className="pb-tray-parts">
          {items.map((item) => entry(item))}
          {!panel && more && folded.map((item) => entry(item, true))}
          {folded.length > 0 && (panel ? (
            <button type="button" className="pb-part pb-more" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet}>
              <b>{tr("更多 {count}", {count})}</b>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" className={`pb-part pb-more ${more ? 'is-open' : ''}`} onClick={() => setMore(!more)} aria-expanded={more}>
              <b>{more ? tr("收起") : tr("更多 {count}", {count})}</b>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      </section>
      {sheet && <Sheet title={tr("更多 {count}", {count})} onClose={() => setSheet(false)}>{panel((type) => { setSheet(false); onPick(type) })}</Sheet>}
    </div>
  )
}
