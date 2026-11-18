import { module as circuit } from 'circuit'
import { OPS } from './ops.js'
import { vocabulary } from './vocabulary.js'
import displaySource from '../capabilities/display.json' with { type: 'json' }
import valueTypeSource from '../capabilities/valueType.json' with { type: 'json' }
import boardSource from '../capabilities/board.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const display = readCopy(displaySource)
const valueType = readCopy(valueTypeSource)
const board = readCopy(boardSource)

export default {
  id: 'logic',
  register(registry) {
    if (!registry.schemas.circuit) circuit.register(registry)
    registry.vocabulary('logic', vocabulary)
    for (const declaration of [display, board, valueType]) {
      for (const [name, item] of Object.entries(declaration.items)) registry.add(declaration.extends, `logic/${name}`, item)
    }
    for (const name of Object.keys(display.items)) registry.implement('display', `logic/${name}`, 'logic/view', 'view')
    for (const [name, item] of Object.entries(OPS)) registry.implement('operation', name, item, 'core')
  },
}
