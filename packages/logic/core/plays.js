import { circuitPlaySchema } from 'circuit'
import { definePlays, playFor } from 'kernel'

import declaration from '../capabilities/play.json' with { type: 'json' }

export const plays = definePlays(Object.fromEntries(Object.entries(declaration.items).map(([id, { configuration }]) => [`logic/${id}`, configuration])), circuitPlaySchema)

/** Apply the task's reveal policy to the circuit template, for the screen and text play alike. */
export function gatesPlayFor(task) {
  const play = playFor(plays, task)
  if (task.blind || task.hideTarget === true) return { ...play, target: 'hidden' }
  if (task.hideTarget === false) return { ...play, target: 'shown' }
  return play
}
