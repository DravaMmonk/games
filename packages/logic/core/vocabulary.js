import { defineVocabulary, qualifyVocabulary } from 'kernel'
import primitiveSource from '../capabilities/primitive.json' with { type: 'json' }
import operationSource from '../capabilities/operation.json' with { type: 'json' }
import familySource from '../capabilities/family.json' with { type: 'json' }
import kindSource from '../capabilities/kind.json' with { type: 'json' }
import wantSource from '../capabilities/want.json' with { type: 'json' }
import markSource from '../capabilities/mark.json' with { type: 'json' }
import languageSource from '../capabilities/language.json' with { type: 'json' }
import gameSource from '../shapes/game.json' with { type: 'json' }
import levelSource from '../shapes/level.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const primitive = readCopy(primitiveSource)
const operation = readCopy(operationSource)
const family = readCopy(familySource)
const kind = readCopy(kindSource)
const want = readCopy(wantSource)
const mark = readCopy(markSource)
const language = readCopy(languageSource)
const game = readCopy(gameSource)
const level = readCopy(levelSource)

export const vocabulary = qualifyVocabulary('logic', defineVocabulary({
  module: 'logic',
  version: 1,
  kinds: Object.fromEntries([primitive, operation, family, kind, want, mark].map(declaration => [declaration.extends ?? declaration.name, declaration.items])),
  game, level,
  languages: language.items,
}))
