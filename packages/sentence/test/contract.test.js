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

test('a grammar can configure chip joining and scope boundaries without a logic package', () => {
  const node = (label, ...children) => ({ label, kind: 'clause', children })
  const slot = (value, kind = 'clause') => ({ kind, value })
  const clause = node('statement', slot({ kind: 'word', children: [] }, 'word'))
  const grammar = holeTree({
    root: 'clause',
    kids: value => value.children,
    withKid: (value, index, child) => ({
      ...value, children: value.children.map((entry, at) => at === index ? { ...entry, value: child } : entry),
    }),
  })
  const join = grammar.joinChips({
    kindOf: value => value.kind,
    fitsSlot: (chip, kind) => chip.kind === kind,
    leadingSlot: value => ['then', 'and'].includes(value.label) ? 0 : null,
    precedenceOf: value => ({ then: 0, and: 1 })[value.label],
    rightAssociative: value => value.label === 'then',
  })
  const place = (tree, label) => join(tree, { kind: 'clause' }, node(label, slot(null), slot(null)))
  const grouping = node('and', slot(clause), slot(clause))
  const draft = node('and', slot(node('quote', slot(grouping))), slot(null))

  assert.deepEqual(place(draft, 'then'), [0, 0])
  assert.deepEqual(place(draft, 'and'), [0, 0])
  assert.deepEqual(place(node('then', slot(clause), slot(clause)), 'then'), [1])
  assert.equal(place(draft, 'quote'), null)
  assert.equal(place(node('statement', slot(null, 'word')), 'then'), null)
})

test('sentence play accepts a consumer resource and the package has no cross-package imports', () => {
  assert.deepEqual(validate(sentencePlaySchema, {
    editor: 'sentence', judge: 'check', checks: 'shown', resources: 'grammar', stage: '', layout: '',
  }), [])
  assert.deepEqual(packageCodeProblems('sentence', new URL('../../../', import.meta.url).pathname), [])
})
