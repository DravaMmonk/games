import { defineVocabulary, qualifyVocabulary } from 'kernel'
import valueTypeSource from '../capabilities/valueType.json' with { type: 'json' }
import primitiveSource from '../capabilities/primitive.json' with { type: 'json' }
import kindSource from '../capabilities/kind.json' with { type: 'json' }
import operationSource from '../capabilities/operation.json' with { type: 'json' }
import familySource from '../capabilities/family.json' with { type: 'json' }
import widgetSource from '../capabilities/widget.json' with { type: 'json' }
import unlockSource from '../capabilities/unlock.json' with { type: 'json' }
import viewSource from '../capabilities/view.json' with { type: 'json' }
import pictureSource from '../capabilities/picture.json' with { type: 'json' }
import sceneSource from '../capabilities/scene.json' with { type: 'json' }
import targetSource from '../capabilities/target.json' with { type: 'json' }
import constraintSource from '../capabilities/constraint.json' with { type: 'json' }
import benchModelSource from '../capabilities/benchModel.json' with { type: 'json' }
import displaySource from '../capabilities/display.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const valueType = readCopy(valueTypeSource)
const primitive = readCopy(primitiveSource)
const kind = readCopy(kindSource)
const operation = readCopy(operationSource)
const family = readCopy(familySource)
const widget = readCopy(widgetSource)
const unlock = readCopy(unlockSource)
const view = readCopy(viewSource)
const picture = readCopy(pictureSource)
const scene = readCopy(sceneSource)
const target = readCopy(targetSource)
const constraint = readCopy(constraintSource)
const benchModel = readCopy(benchModelSource)
const display = readCopy(displaySource)

export const vocabulary = qualifyVocabulary('image', defineVocabulary({
  module: 'image',
  version: 1,
  kinds: Object.fromEntries([valueType, primitive, kind, operation, family, widget, unlock, view, picture, scene, target, constraint, benchModel, display].map(declaration => [declaration.extends ?? declaration.name, declaration.items])),
}))
