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
  const connective = key => ({ key, group: 'conn', kind: 'formula', leads: true, make: () => bin(key, null, null) })
  const bird = atom('Bird', [tvar('x')])
  const flies = atom('Flies', [tvar('x')])
  const partial = bin('∧', all('x', bird), null)
  const last = [0, 0, 0]
  for (const key of ['∧', '∨', '→', '↔']) {
    assert.deepEqual(language.joinsOnto(partial, connective(key), last), [0, 0])
  }

  const compound = bin('∧', all('x', bin('∧', bird, flies)), null)
  assert.deepEqual(language.joinsOnto(compound, connective('→'), [0, 0, 1, 0]), [0, 0])
  const unfinished = all('x', atom('Pair', [tvar('x'), null]))
  assert.equal(language.joinsOnto(unfinished, connective('→'), [0, 0]), null)
})
