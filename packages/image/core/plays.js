import { circuitPlaySchema } from 'circuit'
import { definePlays } from 'kernel'

import workshop from '../shapes/workshop-play.json' with { type: 'json' }
import declaration from '../capabilities/play.json' with { type: 'json' }

export const plays = definePlays(Object.fromEntries(Object.entries(declaration.items).map(([id, { configuration }]) => [
  `image/${id}`, configuration,
])), { ...circuitPlaySchema, workshop })
