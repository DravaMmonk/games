import { introductions } from 'circuit'
import { descriptionOf } from './words.js'

// An unlock earned by an earlier task of this level is part of its play, not a separate award.
export const shownUnlocks = level => level.unlocks.filter(flag => !level.tasks.slice(0, -1).some(task => task.opens.includes(flag)))

export function imagePartCatalog({ course, kit: { types }, LEVELS }) {
  const byFlag = new Map(Object.entries(types).filter(([, spec]) => spec.unlock).map(([type, spec]) => [spec.unlock, type]))
  const textOf = type => ({ label: types[type].label, name: types[type].label, desc: descriptionOf(types, type) })
  const unlockOf = flag => {
    const part = byFlag.get(flag)
    return part ? { key: flag, part, ...textOf(part) } : { key: flag, label: flag, name: flag }
  }
  const primitives = [...introductions(course)].filter(([type]) => types[type]).map(([type, at]) =>
    ({ key: `part:${type}`, type, part: type, ...textOf(type), at }))
  const awards = [...new Set(LEVELS.flatMap(shownUnlocks))].map(unlockOf)
  return { parts: [...primitives, ...awards], unlockOf }
}
