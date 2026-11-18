import { qualifyItems, registeredValueTypes } from 'kernel'
import valueTypesSource from '../capabilities/valueType.json' with { type: 'json' }
import { tableReports } from './baseline.js'
import { modeImplementations } from './course.js'

import { readCopy } from 'kernel/words'

const valueTypes = readCopy(valueTypesSource)

export function register(kernel) {
  for (const [name, implementation] of Object.entries(modeImplementations)) kernel.implement('mode', name, implementation)
  Object.assign(registeredValueTypes, qualifyItems('table', valueTypes.items))
  kernel.kind('table/model', {
    type: 'level', read: value => value, baselineReports: tableReports,
    derived: ['tableWorlds'],
    assemble: ({ schemas }) => ({ tableWorlds: schemas.capabilityImplementations?.['table/world'] }),
  })
}

/** Build a concrete world with typed sensors and read the visible portions of its table. */
export { cell, num, yes, seg, DIR, THIS_CELL, world, visibleSensors, sensorsOf, look } from './model/world.js'

/** Bilingual world labels that follow the active language when rendered or interpolated. */
export { isEn, asText, lazy } from './lang.js'
/** Format signals and construct scene geometry for a world. */
export { signal } from './model/format.js'
export { E as sceneEdge } from './model/scene.js'
export { W } from './model/robot-scene.js'
export { ORDERS, rcName } from './model/algo.js'

/** Share the reference computations between world generators and the hand-played modes. */
export { energy, shade } from './model/picture.js'
export { slipAt, tileAt, policy, valueBase, valueOrder } from './model/value.js'
export { TAG, TAGS } from './model/tags.js'

/** Register a course's play names and expand compact scenes for the puzzle stamp. */
export { registerTablePlays } from './course.js'
export { expandIntroScenes } from './items/figures.js'
