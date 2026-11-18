// The bar the studio's workspaces share (Studio.jsx; games/design/README.md 6.7): the workspace switch, what the workspace
// opens (a package, a game: its children), undo and redo of the pending changeset, the command palette, the busy
// light, language and theme. No tabs: what is shown follows what is picked, and the helpers fold under the middle
// (Drawer.jsx). Undo takes the last pending operation back, redo puts it again: ⌘/Ctrl-Z, ⇧⌘/Ctrl-Z or Ctrl-Y,
// outside a text field (where the keys undo the typing), in every workspace.
import { useEffect, useRef } from 'react'
import { Command, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Redo2, Undo2 } from 'lucide-react'
import { mountBarMenus } from '../menu.js'
import { tr } from '../shell/i18n.js'
import { useWorkspaceKeys } from '../shell/useOverlay.js'
import { MOD } from './Shortcuts.jsx'

const typing = (el) => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

export const SPACES = [['build', '构建', 'Build'], ['arrange', '编排', 'Arrange'], ['copy', '文案', 'Copy']]

/**
 * space: { value, onChange, spaces? (the ids offered) }; ops: the pending changeset; onUndo, onRedo: null when there
 * is nothing to take back or put again; panels: { tree, side (open or not), onToggle(which) }, the left and right
 * columns folded and unfolded from the bar's two ends (Alt+[, Alt+\\).
 */
export default function StudioBar({ space, ops, busy, fresh, onPalette, onUndo = null, onRedo = null, panels = null, children }) {
  const actions = useRef(null)
  useEffect(() => {
    const menus = mountBarMenus(actions.current)
    return () => menus.destroy()
  }, [])
  useWorkspaceKeys((event) => {
    if (panels && event.altKey && !event.metaKey && !event.ctrlKey && (event.code === 'BracketLeft' || event.code === 'Backslash')) {
      event.preventDefault()
      panels.onToggle(event.code === 'BracketLeft' ? 'tree' : 'side')
      return
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey || typing(document.activeElement)) return
    const key = event.key.toLowerCase()
    const again = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey)
    if (key !== 'z' && !again) return
    event.preventDefault()
    if (again) onRedo?.()
    else onUndo?.()
  })
  const go = (next) => {
    if (next === space.value) return
    if (ops.length && !window.confirm(tr('切换工作区会放弃待定操作，确定吗？', 'Switching workspace discards the pending operations. Continue?'))) return
    space.onChange(next)
  }
  return (
    <header className="kit-bar studio-bar">
      <span className="kit-brand"><i className="kit-chip" aria-hidden="true" /></span>
      {panels && <button type="button" className="kit-btn editor-tool studio-panel-toggle" onClick={() => panels.onToggle('tree')} aria-pressed={panels.tree}
        title={`${panels.tree ? tr('收起左栏', 'Fold the left column') : tr('打开左栏', 'Unfold the left column')} (Alt+[)`} aria-label={panels.tree ? tr('收起左栏', 'Fold the left column') : tr('打开左栏', 'Unfold the left column')}>
        {panels.tree ? <PanelLeftClose size={15} aria-hidden="true" /> : <PanelLeftOpen size={15} aria-hidden="true" />}
      </button>}
      <nav className="studio-spaces" role="tablist" aria-label={tr('工作区', 'Workspace')}>
        {SPACES.filter(([id]) => !space.spaces || space.spaces.includes(id)).map(([id, zh, en]) => (
          <button key={id} type="button" role="tab" aria-selected={space.value === id} className={`studio-space ${space.value === id ? 'is-on' : ''}`} onClick={() => go(id)}>{tr(zh, en)}</button>
        ))}
      </nav>
      {children}
      <span className="kit-spacer" />
      <span className="studio-history">
        <button type="button" className="kit-btn editor-tool" disabled={!onUndo} onClick={() => onUndo?.()} aria-label={tr('撤销', 'Undo')} title={`${tr('撤销上一个待定操作', 'Undo the last pending operation')} (${MOD}+Z)`}><Undo2 size={14} aria-hidden="true" /></button>
        <button type="button" className="kit-btn editor-tool" disabled={!onRedo} onClick={() => onRedo?.()} aria-label={tr('重做', 'Redo')} title={`${tr('重做', 'Redo')} (${MOD}+Shift+Z)`}><Redo2 size={14} aria-hidden="true" /></button>
      </span>
      {onPalette && <button type="button" className="studio-palette" onClick={onPalette} title={tr('命令面板')}><Command size={13} aria-hidden="true" /><kbd>{MOD}K</kbd></button>}
      <i className={`studio-busy ${busy || !fresh ? 'is-on' : ''}`} aria-hidden="true" />
      {panels && <button type="button" className="kit-btn editor-tool studio-panel-toggle" onClick={() => panels.onToggle('side')} aria-pressed={panels.side}
        title={`${panels.side ? tr('收起右栏', 'Fold the right column') : tr('打开右栏', 'Unfold the right column')} (Alt+\\)`} aria-label={panels.side ? tr('收起右栏', 'Fold the right column') : tr('打开右栏', 'Unfold the right column')}>
        {panels.side ? <PanelRightClose size={15} aria-hidden="true" /> : <PanelRightOpen size={15} aria-hidden="true" />}
      </button>}
      <div className="kit-actions" ref={actions} />
    </header>
  )
}
