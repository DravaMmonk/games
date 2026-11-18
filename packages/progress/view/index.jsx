import { LockOpen } from 'lucide-react'
import { objectProgress } from '../core/index.js'

export function register(kernel) {
  kernel.game('progress/tracks', (game, content) => { game.objectProgress = objectProgress(content) })
  kernel.unlocks('progress/objects', (game, _level, before, after) => {
    const previous = game.objectProgress({ ...before, all: false })
    return game.objectProgress({ ...after, all: false }).reached()
      .filter(({ kind, target, stage }) => previous.stage(kind, target)?.id !== stage.id)
      .map(({ kind, target, title, stage }) => ({
        key: JSON.stringify([kind, target]), kind: 'reward', label: stage.title ?? title, icon: LockOpen,
      }))
  })
}
