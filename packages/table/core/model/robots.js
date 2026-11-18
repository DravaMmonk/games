import modelsSource from '../../capabilities/robot.json' with { type: 'json' }
import { hydrate } from '../lang.js'

import { readCopy } from 'kernel/words'

const models = readCopy(modelsSource)

/** The stock robot models used by the board and scene renderer. */
export const robots = hydrate(models.items)

export function robotOf(name) {
  return name && robots[`robot-${name.split('/').at(-1)}`]
}
