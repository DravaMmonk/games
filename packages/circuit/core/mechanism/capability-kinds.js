import operationSource from '../../capabilities/operation.json' with { type: 'json' }
import displaySource from '../../capabilities/display.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const operation = readCopy(operationSource)
const display = readCopy(displaySource)

export const capabilityKinds = { operation, display }
