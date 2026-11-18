import { defineVocabulary, qualifyVocabulary } from 'kernel'
import valueType from '../capabilities/valueType.json' with { type: 'json' }
import primitive from '../capabilities/primitive.json' with { type: 'json' }
import kind from '../capabilities/kind.json' with { type: 'json' }
import operation from '../capabilities/operation.json' with { type: 'json' }
import family from '../capabilities/family.json' with { type: 'json' }
import widget from '../capabilities/widget.json' with { type: 'json' }
import unlock from '../capabilities/unlock.json' with { type: 'json' }
import view from '../capabilities/view.json' with { type: 'json' }
import picture from '../capabilities/picture.json' with { type: 'json' }
import scene from '../capabilities/scene.json' with { type: 'json' }
import target from '../capabilities/target.json' with { type: 'json' }
import constraint from '../capabilities/constraint.json' with { type: 'json' }
import benchModel from '../capabilities/benchModel.json' with { type: 'json' }
import display from '../capabilities/display.json' with { type: 'json' }

export const vocabulary = qualifyVocabulary('image', defineVocabulary({
  module: 'image',
  version: 1,
  kinds: Object.fromEntries([valueType, primitive, kind, operation, family, widget, unlock, view, picture, scene, target, constraint, benchModel, display].map(declaration => [declaration.extends ?? declaration.name, declaration.items])),
}))
