import { T } from '../shell/i18n.js'
// The studio's keys, in one sheet (?): the same keys the palette lists beside its actions.
import { L, tr } from '../shell/i18n.js'
import { useOverlay } from '../shell/useOverlay.js'

export const MOD = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform) ? '⌘' : 'Ctrl'
export const KEYS = [
  [`${MOD}+K`, T("命令面板：去任何地方、做任何事")],
  [`${MOD}+Shift+F`, T("在整款游戏里搜索、替换")],
  [`${MOD}+Z`, T("撤销上一个待定操作（不在文字框里时；顶栏也有按钮）")],
  [`${MOD}+Shift+Z · Ctrl+Y`, T("重做撤销的操作")],
  [`${MOD}+Enter`, T("试玩：构建里载入参考解从这一关玩，编排里从选中的关、文案里从选中文字所在的关（或地图）玩")],
  ['F8 / Shift+F8', T("下一处 / 上一处检查结果，在侧栏打开它说的字段")],
  [`${MOD}+L · [[`, T("在文字里插入链接（选中的字拿去搜，换成链接）")],
  ['Alt+1…6', T("「字段」里跳到这一关的第几段")],
  ['Alt+[ / Alt+] / Alt+\\', T("收起或打开左栏 / 检查栏 / 侧栏")],
  ['↑ ↓', T("树上逐关走（Shift：一路选上）")],
  [`${MOD}+click · Shift+click`, T("在树上选几关，批量修改")],
  ['Alt+↑ ↓', T("列表里的一项上移、下移")],
  ['Esc', T("关上面板、取消移动")],
  ['?', T("这张表")],
]

export default function Shortcuts({ onClose }) {
  const overlay = useOverlay(onClose)
  return (
    <div ref={overlay} className="palette-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="palette keys" role="dialog" aria-modal="true" aria-label={tr('快捷键')}>
        <table>
          <tbody>
            {KEYS.map(([keys, label]) => <tr key={keys}><th><kbd>{keys}</kbd></th><td>{L(label)}</td></tr>)}
          </tbody>
        </table>
        <button type="button" className="kit-btn is-label" onClick={onClose} autoFocus>Esc</button>
      </div>
    </div>
  )
}
