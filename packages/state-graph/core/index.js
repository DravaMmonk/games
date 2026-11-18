import { extendLevelSchema } from 'kernel'
import { expandIntroScenes, registerTablePlays } from 'table'
import playsSource from '../capabilities/play.json' with { type: 'json' }
import levelSchemaSource from '../shapes/level.json' with { type: 'json' }
import { WORLDS } from './model/worlds.js'

import { readCopy } from 'kernel/words'

const plays = readCopy(playsSource)
const levelSchema = readCopy(levelSchemaSource)

const meaning = {
 type: 'level', read: value => value,
 levelPuzzle({ puzzle }) {
  if (puzzle.intro) return { intro: expandIntroScenes(puzzle.intro) }
 },
 vocabulary(base) {
  const level = extendLevelSchema(base.level, levelSchema, { extensionTasksFirst: true })
  return { ...base, level }
 },
}
export function register(kernel) {
 kernel.kind('state-graph/level', meaning)
 for (const [name, world] of Object.entries(WORLDS)) kernel.implement('table/world', name, world)
 registerTablePlays(kernel, Object.fromEntries(Object.entries(plays.items).map(([name, { mode }]) => [`state-graph/${name}`, mode])), 'state-graph/levels')
}
