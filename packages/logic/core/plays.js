import { circuitPlaySchema } from 'circuit'
import { definePlays, playFor } from 'kernel'

import declarationSource from '../capabilities/play.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const declaration = readCopy(declarationSource)

export const plays = definePlays(Object.fromEntries(Object.entries(declaration.items).map(([id, { configuration }]) => [`logic/${id}`, configuration])), circuitPlaySchema)

/** Apply the task's reveal policy to the circuit template, for the screen and text play alike. */
export function gatesPlayFor(task) {
  const play = playFor(plays, task)
  if (task.blind || task.hideTarget === true) return { ...play, target: 'hidden' }
  if (task.hideTarget === false) return { ...play, target: 'shown' }
  return play
}
