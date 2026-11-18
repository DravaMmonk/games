import { defineVocabulary, qualifyVocabulary } from 'kernel'
import familySource from '../../capabilities/family.json' with { type: 'json' }
import gameSource from '../../shapes/game.json' with { type: 'json' }
import levelSource from '../../shapes/level.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const family = readCopy(familySource)
const game = readCopy(gameSource)
const level = readCopy(levelSource)

export const vocabulary = qualifyVocabulary('circuit', defineVocabulary({
  module: 'circuit',
  version: 1,
  kinds: Object.fromEntries([family].map(declaration => [declaration.extends ?? declaration.name, declaration.items])),
  game, level,
}))
