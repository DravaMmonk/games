import assert from 'node:assert/strict'
import { test } from 'node:test'
import { all, atom, bin, tvar } from '../core/formula.js'
import { sentenceLanguage } from '../core/sentenceLanguage.js'

test('a formula variable is accepted within its own region or in the surrounding scope', () => {
  const tree = bin('∧', all('x', atom('P', [null])), atom('P', [null]))
  const x = { kind: 'term', group: 'var', text: 'x' }
  const y = { ...x, text: 'y' }
  const language = sentenceLanguage({}, 'formula', ['y'])
  assert.equal(language.refuse(tree, [0, 0, 0], x), null)
  assert.ok(language.refuse(tree, [1, 0], x))
  assert.equal(language.refuse(tree, [1, 0], y), null)
})

test('infix chips continue a completed predicate inside its quantifier before an outer hole', () => {
  const language = sentenceLanguage({})
  const join = (tree, op) => language.joinsOnto(tree, { kind: 'formula' }, bin(op, null, null))
  const bird = atom('Bird', [tvar('x')])
  const flies = atom('Flies', [tvar('x')])
  const partial = bin('∧', all('x', bird), null)
  for (const key of ['∧', '∨', '→', '↔']) {
    assert.deepEqual(join(partial, key), [0, 0])
  }

  const compound = bin('∧', all('x', bin('∧', bird, flies)), null)
  assert.deepEqual(join(compound, '→'), [0, 0])
  const unfinished = all('x', atom('Pair', [tvar('x'), null]))
  assert.equal(join(unfinished, '→'), null)
  assert.deepEqual(join(bin('∧', null, bin('∨', bird, flies)), '∧'), [1, 1])
})
