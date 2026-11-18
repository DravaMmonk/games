import { circuitPlaySchema } from 'circuit'
import { definePlays } from 'kernel'

import workshopSource from '../shapes/workshop-play.json' with { type: 'json' }
import declarationSource from '../capabilities/play.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const workshop = readCopy(workshopSource)
const declaration = readCopy(declarationSource)

export const plays = definePlays(Object.fromEntries(Object.entries(declaration.items).map(([id, { configuration }]) => [
  `image/${id}`, configuration,
])), { ...circuitPlaySchema, workshop })
