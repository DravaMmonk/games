import { module as circuit } from 'circuit'
import { OPS } from './ops.js'
import { vocabulary } from './vocabulary.js'
import display from '../capabilities/display.json' with { type: 'json' }
import valueType from '../capabilities/valueType.json' with { type: 'json' }
import board from '../capabilities/board.json' with { type: 'json' }

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
