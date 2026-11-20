import { shownName } from "kernel/view"
import { tr } from 'kernel/words'
// Where a part comes into the course, under its page in the studio (part-uses.js): one chip a level or task that names
// the part or its stages, its uses as icons (their words in the tooltip) and the stages it brings as numbers; a chip
// opens the level on the field that says it. Read from the content, so a package shows it as a game does.
import { Award, ChevronsUp, CircleMinus, Gift, Link2, LockOpen, MapPin, PackagePlus, Waypoints } from 'lucide-react'

import { partUses } from '../../../core/progression/part-uses.js'

const KINDS = {
  adds: [PackagePlus, () => tr("这一关带来")],
  gives: [Gift, () => tr("只在这里给")],
  awards: [Award, () => tr("通关奖励")],
  opens: [LockOpen, () => tr("在这里开放")],
  local: [MapPin, () => tr("只在这一关用")],
  withholds: [CircleMinus, () => tr("这里扣下")],
  requiresObjects: [Link2, () => tr("需要先有它")],
  after: [ChevronsUp, () => tr("过了这里升到这个阶段")],
}

/** `content` the package or game; `part` the full id; `namespace` names shown short; `onOpen({ level, task, path })`. */
export default function PartUses({ content, part, namespace, onOpen }) {
  const uses = partUses(content, part)
  if (!uses.length) return null
  // One chip a level or task, in course order.
  const chips = []
  for (const use of uses) {
    const last = chips.at(-1)
    if (last && last.level === use.level && last.task === use.task) last.uses.push(use)
    else chips.push({ level: use.level, task: use.task, uses: [use] })
  }
  const label = tr("在哪些关卡出现")
  return (
    <nav className="part-uses" aria-label={label}>
      <span className="part-uses-mark" role="img" title={label} aria-label={label}><Waypoints size={13} aria-hidden="true" /></span>
      {chips.map((chip) => {
        const kinds = [...new Set(chip.uses.map((use) => use.kind))]
        const stages = [...new Set(chip.uses.map((use) => use.stage).filter(Boolean))]
        const where = `${shownName(namespace, chip.level)}${chip.task === undefined ? '' : ` · ${tr("任务 {k}", { k: chip.task + 1 })}`}`
        const says = chip.uses.map((use) => `${KINDS[use.kind][1]()}${use.stage ? ` · ${tr("阶段 {n}", { n: use.stage })}` : ''}`)
        return (
          <button key={`${chip.level} ${chip.task ?? ''}`} type="button" className="object-link part-use" title={[where, ...says].join('\n')}
            onClick={() => onOpen({ level: chip.level, task: chip.task, path: chip.uses[0].path })}>
            <span className="part-use-kinds">{kinds.map((kind) => { const Icon = KINDS[kind][0]; return <Icon key={kind} size={12} aria-hidden="true" /> })}</span>
            <code>{shownName(namespace, chip.level)}</code>
            {chip.task !== undefined && <small>{chip.task + 1}</small>}
            {stages.length > 0 && <span className="part-use-stages" aria-label={tr("阶段 {n}", { n: stages.join(', ') })}>{stages.map((stage) => <b key={stage}>{stage}</b>)}</span>}
          </button>
        )
      })}
    </nav>
  )
}
