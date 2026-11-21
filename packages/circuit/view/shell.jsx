import { Package } from 'lucide-react'
import { L } from "kernel/view"
import { tr } from 'kernel/words'
import PartsBook, { levelOf, useParts } from './PartsBook.jsx'
import { iconOf } from './parts/icons.js'

/** Circuit-owned panels and references mounted in the generic game shell. */
export function useCircuitShell(context) {
  const { game, progress, phone, setSheet } = context
  const box = useParts(game, progress)
  const listedPart = id => id && box.all.find(part => part.key === id || part.part === id)
  // A single-level preview keeps the package's part definitions but may omit the levels that introduce them.
  const authoredPart = id => {
    const type = id?.replace(/^(?:part|lemma):/, '')
    const definition = game.partDefs?.parts?.[type]
    return definition && { key: id, part: type, name: definition.name, desc: definition.desc, icon: iconOf(definition.icon), family: definition.family }
  }
  return {
    mapActions: <>
      {game.parts && <button className="kit-btn is-label wiki-button" onClick={() => setSheet('circuit/parts')}><Package size={15} /><span>{tr('元件箱')}</span><b>{box.unread.length > 0 ? tr("新增 {length} 个", {length: box.unread.length}) : `${game.parts.earned(progress).length}/${game.parts.all.length}`}</b></button>}
    </>,
    reference(kind, id) {
      if (kind !== 'part') return null
      const listed = listedPart(id)
      const value = listed ?? authoredPart(id)
      return value && { title: L(value.name), open: listed ? box.earned.has(listed.key) : progress.all, at: levelOf(game, value), panel: 'circuit/parts' }
    },
    panel({ sheet, start, close }) {
      if (sheet !== 'circuit/parts') return null
      const listed = listedPart(start?.id)
      const extra = !listed && authoredPart(start?.id)
      const parts = extra ? { ...box, all: [...box.all, extra], earned: new Set([...box.earned, extra.key]) } : box
      return <PartsBook game={game} box={parts} phone={phone} start={listed ? { ...start, id: listed.key } : start} onClose={close} />
    },
    progressText: {
      all: tr('所有关卡、任务、元件和百科均已开放，进度照常记录。清空进度会恢复正常解锁。'),
      open: tr('开放所有关卡、任务、元件和百科。'),
      clear: tr('清空后，这台设备上已通过的关卡、搭建的电路和获得的元件将全部删除，无法恢复。'),
      leave: tr('这一关的电路和进度都会保存，可以随时返回。'),
    },
  }
}
