import { useState } from 'react'
import { Info, Settings } from 'lucide-react'
import { L, tr } from './i18n.js'
import { Text } from './Layout.jsx'
import { fileMark } from './edit.js'
import Popover from './Popover.jsx'
import { useLang } from './useLang.js'
import SettingsPanel from './SettingsPanel.jsx'
import './topbar.css'

export function GameBrand({ game, showInfo, edit }) {
  return (
    <div className="game-brand">
      <span className="kit-brand"><i className="kit-chip" aria-hidden="true" /><span>{L(game.title)}</span></span>
      {showInfo && game.lede && <GameInfo lede={game.lede} edit={edit} />}
    </div>
  )
}

function GameInfo({ lede, edit }) {
  const [anchor, setAnchor] = useState(null)
  const label = tr('游戏简介')
  return (
    <>
      <button type="button" className="kit-btn is-quiet" aria-label={label} aria-haspopup="dialog" aria-expanded={Boolean(anchor)} onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}>
        <Info size={15} aria-hidden="true" />
      </button>
      {anchor && (
        <Popover anchor={anchor} title={label} placement="below" className="game-info-pop" onClose={() => setAnchor(null)}>
          <Text text={lede} mark={fileMark(edit, 'game', ['lede'])} />
        </Popover>
      )}
    </>
  )
}

export default function TopBar({ children, className = '', game, theme, onTheme }) {
  useLang()
  const [anchor, setAnchor] = useState(null)
  return <>
    <header className={`kit-bar ${className}`}>
      {children}
      <div className="kit-actions">
        <button type="button" className="kit-btn" aria-label={tr('设置')} aria-expanded={Boolean(anchor)} onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}><Settings size={16} /></button>
      </div>
    </header>
    {anchor && <SettingsPanel game={game} theme={theme} onTheme={onTheme} anchor={anchor} onClose={() => setAnchor(null)} />}
  </>
}
