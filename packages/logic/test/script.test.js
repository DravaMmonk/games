import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkScript } from '../core/script.js'

const showBy = (level, by, using) => checkScript(level, [{ k: 'show', stmt: level.goal, by, using }])

test('script simp repeats the configured rewrites in order', () => {
  const level = {
    kind: 'logic/script',
    goal: 'twice(twice(zero)) = zero',
    consts: ['zero', 'other'],
    defs: ['twice(x) = once(x)', 'once(x) = x', 'twice(x) = other'],
    simp: ['def.0', 'def.1', 'def.2'],
  }
  assert.equal(showBy(level, 'simp').pass, true)
  assert.equal(showBy({ ...level, simp: ['def.2', 'def.0', 'def.1'] }, 'simp').pass, false)
  assert.equal(showBy({ ...level, simp: ['def.0'] }, 'simp').pass, false)
  assert.equal(showBy({ ...level, simp: ['def.0', 'def.1', 'missing'] }, 'simp').pass, false)
})

test('script simp checks the conditions of a rewrite against the named facts', () => {
  const level = {
    kind: 'logic/script',
    goal: 'pick(zero) = zero',
    consts: ['zero'],
    premises: { p: 'Allowed(zero)' },
    defs: ['Allowed(x) ⟹ pick(x) = x'],
    simp: ['def.0'],
  }
  assert.equal(showBy(level, 'simp', ['p']).pass, true)
  assert.equal(showBy(level, 'simp').pass, false)
})

test('script simp rewrites with named givens when hyp is in its rule set', () => {
  const level = {
    kind: 'logic/script',
    goal: 's(plus(a, zero)) = s(a)',
    consts: ['a', 'zero'],
    premises: { ih: 'plus(a, zero) = a' },
    simp: ['hyp'],
  }
  assert.equal(showBy(level, 'simp', ['ih']).pass, true)
  assert.equal(showBy(level, 'simp').pass, false)
  assert.equal(showBy({ ...level, simp: [] }, 'simp', ['ih']).pass, false)
})

test('script induction simplifies each constructor case with its induction hypothesis', () => {
  const level = {
    kind: 'logic/script',
    goal: '∀x. plus(x, zero) = x',
    consts: ['zero'],
    datatypes: { nat: 'zero | s(nat)' },
    defs: ['plus(zero, y) = y', 'plus(s(x), y) = s(plus(x, y))'],
    simp: ['def.0', 'def.1'],
  }
  assert.equal(showBy(level, 'induct').pass, true)
  assert.equal(showBy(level, 'simp').pass, false)
  assert.equal(showBy({ ...level, simp: ['def.1'] }, 'induct').pass, false)
  assert.equal(showBy({ ...level, simp: ['def.0'] }, 'induct').pass, false)
})
