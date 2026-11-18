import { S } from 'kernel'
import { expandIntroScenes, registerTablePlays } from 'table'
import plays from '../capabilities/play.json' with { type: 'json' }
import levelSchema from '../shapes/level.json' with { type: 'json' }
import { WORLDS } from './model/worlds.js'

const meaning = {
 type: 'level', read: value => value,
 levelPuzzle({ puzzle }) {
  if (puzzle.intro) return { intro: expandIntroScenes(puzzle.intro) }
 },
 vocabulary(base) {
  const fields = { ...base.level?.fields, ...levelSchema.fields }
  if (base.level) for (const key of Object.keys(levelSchema.fields).filter(key => key !== 'tasks')) {
   const previous = base.level.fields[key]
   if (!previous) fields[key] = S.opt(fields[key])
   else { const alternatives = S.either(previous, fields[key]); fields[key] = previous.optional || fields[key].optional ? S.opt(alternatives) : alternatives }
  }
  const level = base.level ? S.obj({ ...fields, tasks: S.list(S.either(levelSchema.fields.tasks.of, base.level.fields.tasks.of), { min: 1 }) }) : levelSchema
  return { ...base, level }
 },
}
export function register(kernel) {
 kernel.kind('state-graph/level', meaning)
 for (const [name, world] of Object.entries(WORLDS)) kernel.implement('table/world', name, world)
 registerTablePlays(kernel, Object.fromEntries(Object.entries(plays.items).map(([name, { mode }]) => [`state-graph/${name}`, mode])), 'state-graph/levels')
}
