import { useMemo } from 'react'
import { SettingsContext } from 'kernel/view'
import { boardPlay } from '../core/board-play.js'
import CircuitLevel from './CircuitLevel.jsx'
import { partsFor } from './board/board-parts.js'
import { iconOf } from './parts/icons.js'
import PartFace from './parts/PartFace.jsx'

/** The package play mounts the same board editor used by the remaining native modules. */
export default function BoardPlay({
  context, work, onChange, phone, play = boardPlay, extraCards, settings, run,
}) {
  const { task, works, view } = useMemo(() => play.contextOf(context), [play, context])
  const defined = { of: type => works.defs[type], defaults: works.defaultsOf, ...(settings && { ops: {} }), value: () => null }
  const cards = { ...extraCards, ...Object.fromEntries(Object.entries(works.defs).map(([type, def]) => [type, { ...def, icon: iconOf(def.icon) }])) }
  const parts = partsFor(task, view, { cards, portLabels: {}, defined })
  const flags = new Set(context.progress?.flags ?? [])
  const offered = works.offerIn(task, flags)
  const item = ({ type, fresh }) => ({ type, label: cards[type]?.name ?? type, desc: cards[type]?.desc, icon: cards[type]?.icon, fresh })
  const face = (node, ctx, mode) => {
    const def = defined.of(node.type)
    return def ? <PartFace def={def} face={mode} node={node} ctx={ctx} defined={defined} set={ctx.setParams && ((params, key) => ctx.setParams(node, params, key))} /> : null
  }
  const game = { ...(settings && { id: context.content.id, settings }), course: works.course, textAt: text => text, isCircuitPart: type => Boolean(cards[type] || view.BUILT[type]) }
  const editor = <CircuitLevel screen={{ game, level: { ...task, source: task }, phone }}
    board={{ circuit: work ?? play.initial(context), change: onChange, clear: () => onChange(play.initial(context)) }}
    run={run}
    parts={parts} defined={defined} items={offered.shown.map(item)} folded={offered.folded.map(item)} types={offered.types}
    card={{ body: (node, ctx) => face(node, ctx, 'card'), thumb: (node, ctx) => face(node, ctx, 'tile') }}
    sheet={(node, ctx) => face(node, ctx, 'detail')} tabs={false} pad={null} />
  return settings ? <SettingsContext.Provider value={game}>{editor}</SettingsContext.Provider> : editor
}
