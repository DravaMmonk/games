import { sentencePlaySchema } from 'sentence'
import { circuitPlaySchema } from 'circuit'
import { definePlays, playFor, resourcePlaySchema } from 'kernel'

import declarationSource from '../capabilities/play.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const declaration = readCopy(declarationSource)

const schemas = {
  ...circuitPlaySchema,
  sentence: sentencePlaySchema,
  tree: resourcePlaySchema('tree', ['once']),
  scenario: resourcePlaySchema('scenario', ['steps']),
  lookup: resourcePlaySchema('lookup', ['steps']),
  checks: resourcePlaySchema('checks', ['boards']),
}

export const plays = definePlays(Object.fromEntries(Object.entries(declaration.items).map(([id, { configuration }]) => [`logic/${id}`, configuration])), schemas)

/** Apply the task's reveal policy to the circuit template, for the screen and text play alike. */
export function gatesPlayFor(task) {
  const play = playFor(plays, task)
  if (task.blind || task.hideTarget === true) return { ...play, target: 'hidden' }
  if (task.hideTarget === false) return { ...play, target: 'shown' }
  return play
}
