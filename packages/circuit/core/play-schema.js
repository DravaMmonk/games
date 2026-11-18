import circuitSource from '../shapes/circuit-play.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const circuit = readCopy(circuitSource)

export const circuitPlaySchema = { circuit }
