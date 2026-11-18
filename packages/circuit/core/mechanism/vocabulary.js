import { defineVocabulary, qualifyVocabulary } from 'kernel'
import family from '../../capabilities/family.json' with { type: 'json' }
import game from '../../shapes/game.json' with { type: 'json' }
import level from '../../shapes/level.json' with { type: 'json' }

export const vocabulary = qualifyVocabulary('circuit', defineVocabulary({
  module: 'circuit',
  version: 1,
  kinds: Object.fromEntries([family].map(declaration => [declaration.extends ?? declaration.name, declaration.items])),
  game, level,
}))
