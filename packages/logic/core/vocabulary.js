import { defineVocabulary, qualifyVocabulary } from 'kernel'
import primitive from '../capabilities/primitive.json' with { type: 'json' }
import operation from '../capabilities/operation.json' with { type: 'json' }
import family from '../capabilities/family.json' with { type: 'json' }
import kind from '../capabilities/kind.json' with { type: 'json' }
import want from '../capabilities/want.json' with { type: 'json' }
import mark from '../capabilities/mark.json' with { type: 'json' }
import language from '../capabilities/language.json' with { type: 'json' }
import game from '../shapes/game.json' with { type: 'json' }
import level from '../shapes/level.json' with { type: 'json' }

export const vocabulary = qualifyVocabulary('logic', defineVocabulary({
  module: 'logic',
  version: 1,
  kinds: Object.fromEntries([primitive, operation, family, kind, want, mark].map(declaration => [declaration.extends ?? declaration.name, declaration.items])),
  game, level,
  languages: language.items,
}))
