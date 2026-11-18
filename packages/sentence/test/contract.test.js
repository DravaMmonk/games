import assert from 'node:assert/strict'
import { test } from 'node:test'
import { holeTree, sentencePlaySchema, treeKey } from 'sentence'
import { validate } from 'kernel'
import { packageCodeProblems } from '../../../games/kit/engine/plugin-boundaries.js'

test('a grammar can fill English sentence slots without a logic or circuit package', () => {
  const grammar = holeTree({
    root: 'sentence',
    kids: node => typeof node === 'string' ? [] : [
      { kind: 'subject', value: node.subject },
      { kind: 'verb', value: node.verb },
    ],
    withKid: (node, index, value) => ({ ...node, [index === 0 ? 'subject' : 'verb']: value }),
  })
  const blank = { subject: null, verb: null }
  assert.deepEqual(grammar.holesOf(blank).map(({ path, kind }) => [treeKey(path), kind]), [
    ['r.0', 'subject'],
    ['r.1', 'verb'],
  ])
  const subject = grammar.setAt(blank, [0], 'birds')
  assert.equal(grammar.complete(subject), false)
  const sentence = grammar.setAt(subject, [1], 'sing')
  assert.deepEqual(sentence, { subject: 'birds', verb: 'sing' })
  assert.equal(grammar.complete(sentence), true)
  assert.deepEqual(blank, { subject: null, verb: null })
})

test('sentence play accepts a consumer resource and the package has no cross-package imports', () => {
  assert.deepEqual(validate(sentencePlaySchema, {
    editor: 'sentence', judge: 'check', checks: 'shown', resources: 'grammar', stage: '', layout: '',
  }), [])
  assert.deepEqual(packageCodeProblems('sentence', new URL('../../../', import.meta.url).pathname), [])
})
