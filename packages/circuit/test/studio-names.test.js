import test from 'node:test'
import assert from 'node:assert/strict'
import { partMeaning } from '../core/content-meaning.js'
import { referenceCatalog } from '../../../games/kit/studio/reference-catalog.js'
import { refProblems } from '../../../games/kit/engine/text.js'

test('package authoring names resolve the same component links as the game', () => {
  const content = { partDefs: { parts: { 'sample/join': { name: { en: 'Join' } } } } }
  const references = partMeaning.referencesForTool({ content })
  const catalog = referenceCatalog({ references })
  assert.deepEqual(refProblems({ en: '<part-ref to="part:sample/join"></part-ref>' }, '', catalog.byKind), [])
  assert.equal(references[0].items[0].object, 'sample/join')
  assert.equal(catalog.options[0].value, 'part:part:sample/join')
})
