import { partMeaning, trayMeaning } from '../content-meaning.js'


import { BUILTINS, BUILTIN_ITEMS } from "../parts/builtins.js"
import { OPS } from "./ops.js"




import { vocabulary } from "./vocabulary.js"

export default {
  id: 'circuit',
  register(registry) {
    registry.kind('circuit/part', partMeaning)
    registry.kind('circuit/tray', trayMeaning)
    registry.vocabulary('circuit', vocabulary)
    registry.add('display', 'circuit/screen', { about: { zh: '电路卡片与结果呈现', en: 'Circuit cards and result presentation' }, role: 'circuit' })
    registry.implementDisplays(['circuit/screen'], 'circuit/view')
    Object.assign(registry.kinds.op, BUILTIN_ITEMS)
    for (const [name, item] of Object.entries(BUILTIN_ITEMS)) registry.add('operation', name, { kind: 'op', ...item })
    registry.implementOperations({ ...OPS, ...BUILTINS })
    registry.add('valueType', 'circuit/number', {})
    registry.add('valueType', 'circuit/boolean', {})
    registry.add('valueType', 'circuit/string', {})
    registry.add('valueType', 'circuit/list', {})
    registry.add('valueType', 'circuit/any', {})
    registry.add('board', 'circuit/board', { valueTypes: ['circuit/number'] })
  },
}
