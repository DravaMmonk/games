import { useLayoutEffect, useRef, useState } from 'react'
import { L, T, tr } from '../shell/i18n.js'

const PANELS = { tree: T('对象'), main: T('编辑区'), side: T('字段') }
const panelId = (panel) => `studio-panel-${panel}`
const panelLabel = (panel) => L(PANELS[panel])

export function mobilePanelProps(panel) {
  return { id: panelId(panel), tabIndex: -1, 'aria-label': panelLabel(panel) }
}

export function useMobilePanels() {
  const [panel, setPanel] = useState('main')
  const focusPanel = useRef(false)
  useLayoutEffect(() => {
    if (!window.matchMedia('(max-width: 760px)').matches) return
    window.scrollTo(0, 0)
    if (focusPanel.current) document.getElementById(panelId(panel))?.focus({ preventScroll: true })
    focusPanel.current = false
  }, [panel])

  const showPanel = (next, focus = false) => {
    if (!window.matchMedia('(max-width: 760px)').matches) return
    focusPanel.current = focus
    setPanel(next)
  }
  return [panel, showPanel]
}

export default function MobilePanels({ panel, onChange }) {
  return (
    <nav className="studio-mobile-panels" aria-label={tr('工作区面板')}>
      {Object.keys(PANELS).map((id) => (
        <button key={id} type="button" className="kit-btn" aria-pressed={panel === id} aria-controls={panelId(id)} onClick={() => onChange(id)}>{panelLabel(id)}</button>
      ))}
    </nav>
  )
}
