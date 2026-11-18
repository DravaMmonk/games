import { capabilityKinds } from './capability-kinds.js'
import { partMeaning, trayMeaning } from '../content-meaning.js'


import { BUILTINS, BUILTIN_ITEMS } from "../parts/builtins.js"




import board from '../../capabilities/board.json' with { type: 'json' }
import display from '../../capabilities/display.json' with { type: 'json' }
import { vocabulary } from "./vocabulary.js"

export default {
  id: 'circuit',
  register(registry) {
    registry.kind('circuit/part', partMeaning)
    registry.kind('circuit/tray', trayMeaning)
    registry.vocabulary('circuit', vocabulary)
    registry.add('display', 'circuit/screen', display.items.screen)
    Object.assign(registry.definitions, capabilityKinds)
    registry.implement('display', 'circuit/screen', 'circuit/view', 'view')
    for (const [name, item] of Object.entries(BUILTIN_ITEMS)) registry.add('operation', name, item)
    for (const [name, item] of Object.entries(BUILTINS)) registry.implement('operation', name, item, 'core')
    registry.add('board', 'circuit/board', board.items.board)
  },
}
