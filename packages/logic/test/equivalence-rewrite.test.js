import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse, show } from '../core/formula.js'
import { localRewrites, rewrite, rewriteOptions, rewritePreview, rewriteTarget } from '../core/rewrite.js'
import { startState } from '../core/tactics.js'

const source = 'qed/iffSubst'
const [, forward, reverse] = localRewrites({
  ruleParts: { 'logic/iffSubst': source },
  partDefs: { [source]: { name: { en: 'Equivalent substitution', zh: '等价代换' } } },
})

test('equivalence substitution can select one occurrence in another given', () => {
  const state = startState(parse('A'), ['A ↔ B', 'B ∧ ¬B'].map(parse))
  const options = rewriteOptions(state, [reverse])
  assert.deepEqual(options.map(({ value }) => value), ['hyp-1-0', 'hyp-1-1'])
  assert.equal(rewriteTarget(undefined, options), 'hyp-1-0')
  const picked = options[1]
  const result = rewrite(state, reverse, picked.value).results[0].goals[0]
  assert.equal(show(result.goal), 'A')
  assert.deepEqual(result.hyps.map((formula) => show(formula)), ['A ↔ B', 'B ∧ ¬A'])
  assert.equal(show(rewritePreview(picked).original), show(result.hyps[1]))
  assert.ok(rewrite(state, reverse, 'hyp-0-0').fail)
})

test('equivalence substitution checks the goal first, then givens in their own order', () => {
  const state = startState(parse('A'), ['C ↔ D', 'A ↔ B', 'A ∧ B', 'C ∧ D'].map(parse))
  const options = rewriteOptions(state, [forward])
  assert.deepEqual(options.map(({ value }) => value), ['goal-0', 'hyp-2-0', 'hyp-3-0'])
  assert.equal(rewriteTarget(undefined, options), 'goal-0')
  const result = rewrite(state, forward, 'hyps').results[0].goals[0]
  assert.deepEqual(result.hyps.map((formula) => show(formula)), ['C ↔ D', 'A ↔ B', 'B ∧ B', 'C ∧ D'])
})
