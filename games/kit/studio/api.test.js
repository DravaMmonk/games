import test from 'node:test'
import assert from 'node:assert/strict'
import { browserVocabulary } from './api.js'

test('Studio reconstructs resolved object metadata without a second catalog lookup', () => {
  const vocabulary = browserVocabulary({ layerOrder: ['sample'], legacyModules: [], packageCode: true, kindDeclarations: {
    'sample/picture': { declares: 'package', overrides: { package: ['*'], game: ['$text'] }, folder: 'pictures', schema: { type: 'obj', fields: {} }, studio: { name: { en: 'Picture', $key: 'sample/kind.picture.name' }, icon: 'Image' } },
    'sample/labels': { declares: 'package', overrides: {}, extends: 'sample/picture', fields: { label: { type: 'text' } } },
  } })
  assert.equal(vocabulary.objectKinds['sample/picture'].schema.fields.label.type, 'text')
  assert.equal(vocabulary.objectKinds['sample/picture'].studio.name.en, 'Picture')
})
