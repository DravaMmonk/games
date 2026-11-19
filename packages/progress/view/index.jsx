import { LockOpen } from 'lucide-react'
import { objectProgress, policyFor } from '../core/index.js'

export function register(kernel) {
  kernel.game('progress/objects', (game, content) => {
    const read = objectProgress(content)
    const snapshots = new WeakMap()
    game.objectProgress = (progress, at) => {
      if (at) return read(progress, at)
      if (!snapshots.has(progress)) snapshots.set(progress, read(progress))
      return snapshots.get(progress)
    }
    game.progressContent = content
  })
  kernel.unlocks('progress/objects', (game, level, before, after) => {
    const sources = game.progressUnlockSources ?? []
    const adapted = new Set()
    const rewards = sources.flatMap(({ kind, read }) => read(game, level, before, after)
      .filter(item => policyFor(game.progressContent, kind, item.key).unlocks)
      .map(item => {
        adapted.add(JSON.stringify([kind, item.key]))
        return item
      }))
    const previous = game.objectProgress({ ...before, all: false })
    const objects = game.objectProgress({ ...after, all: false }).reached()
      .filter(({ kind, target, stage }) => !adapted.has(JSON.stringify([kind, target]))
        && (!sources.some(source => source.kind === kind) || stage.afterLevel || stage.afterTask)
        && previous.stage(kind, target)?.id !== stage.id)
      .map(({ kind, target, title, stage }) => ({
        key: JSON.stringify([kind, target]), kind: 'reward', label: stage.definition.title ?? stage.definition.name ?? title, icon: LockOpen,
      }))
    return [...rewards, ...objects]
  })
}
