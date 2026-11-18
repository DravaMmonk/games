import { earnedUnlocks } from '../index.js'

/** The course rewards made available by this completion, in course order. */
export function partUnlocks(game, level, before, after) {
  const wasSolved = new Set(before.solved)
  const known = new Set(game.earnedParts({ ...before, all: false }).map(({ part }) => part))
  const parts = new Map()
  if (!wasSolved.has(level.id)) {
    for (const part of game.unlocked({ ...level, unlocks: earnedUnlocks(level, after) })) {
      if (part.part) parts.set(part.part, part)
    }
  }
  for (const part of game.earnedParts({ ...after, all: false })) {
    if (!known.has(part.part)) parts.set(part.part, { ...part, label: part.name })
  }
  return [...parts.values()].map(part => ({ ...part, key: part.part, kind: 'reward' }))
}
