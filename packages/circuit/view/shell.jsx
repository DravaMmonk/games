import { Package } from 'lucide-react'
import { L, tr } from 'kernel/view'
import PartsBook, { levelOf, useParts } from './PartsBook.jsx'

/** Circuit-owned panels and references mounted in the generic game shell. */
export function useCircuitShell(context) {
  const { game, progress, phone, setSheet } = context
  const box = useParts(game, progress)
  const part = id => game.parts?.all.find(part => part.key === id)
  return {
    mapActions: <>
      {game.parts && <button className="kit-btn is-label wiki-button" onClick={() => setSheet('circuit/parts')}><Package size={15} /><span>{tr('元件箱')}</span><b>{box.unread.length > 0 ? tr(`新增 ${box.unread.length} 个`, `${box.unread.length} new`) : `${game.parts.earned(progress).length}/${game.parts.all.length}`}</b></button>}
    </>,
    reference(kind, id) {
      if (kind !== 'part') return null
      const value = part(id)
      return value && { title: L(value.name), open: box.earned.has(id), at: levelOf(game, value), panel: 'circuit/parts' }
    },
    panel({ sheet, start, close }) {
      return sheet === 'circuit/parts' && <PartsBook game={game} box={box} phone={phone} start={start} onClose={close} />
    },
    progressText: {
      all: tr('所有关卡、任务、元件和百科均已开放，进度照常记录。清空进度会恢复正常解锁。'),
      open: tr('开放所有关卡、任务、元件和百科。'),
      clear: tr('清空后，这台设备上已通过的关卡、搭建的电路和获得的元件将全部删除，无法恢复。'),
      leave: tr('这一关的电路和进度都会保存，可以随时返回。'),
    },
  }
}
