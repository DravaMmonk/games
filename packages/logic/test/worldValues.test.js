import assert from 'node:assert/strict'
import { test } from 'node:test'
import { worldCheck } from '../core/worldValues.js'
import { queryCheck } from '../core/formulaWork.js'

const meant = '∀x. ∃y. Likes(x, y)'
const wrong = '∃y. ∀x. Likes(x, y)'
const check = worldCheck({
  meant, wrong, notation: {},
  vocab: { names: [], consts: [], preds: [['Likes', 2]] },
})

test('counterexample checks reject an empty domain and formula text before evaluation', () => {
  for (const work of [wrong, { size: 0, preds: {} }, null]) {
    const { fail, run } = check.report(work)
    assert.equal(fail.why.en, 'Enter valid scenario settings.')
    assert.deepEqual(run, { steps: [{ failed: fail.why }], lines: [] })
  }
})

test('a nonempty world must separate the translations', () => {
  const all = { size: 1, preds: { Likes: ['0,0'] } }
  const rejected = check.report(all)
  assert.deepEqual(rejected.fail, check.judge(all))
  assert.equal(rejected.fail.check, 0)
  assert.deepEqual(rejected.run.steps, [{ failed: rejected.fail.why }])
  const distinct = { size: 2, preds: { Likes: ['0,0', '1,1'] } }
  assert.equal(check.judge(distinct), null)
  assert.deepEqual(check.run(distinct).steps, [{}])
})

test('a world checks an inference one premise at a time and requires a false conclusion', () => {
  const inference = worldCheck({
    given: ['∀x. Human(x) → Mortal(x)', 'Mortal(h)'],
    goal: 'Human(h)',
    notation: { symbols: ['∀', '→'] },
    vocab: { names: ['h'], consts: ['h'], preds: [['Human', 1], ['Mortal', 1]] },
  })
  assert.equal(inference.board.rows[0].slots[0].text.en, 'Human(h)')
  assert.equal(inference.board.rows[1].slots.length, 2)
  const failed = inference.report({ size: 1, preds: {} })
  assert.equal(failed.fail.check, 1)
  assert.equal(failed.run.steps.length, 2)
  const passed = inference.report({ size: 1, preds: { Mortal: ['0'] } })
  assert.equal(passed.fail, null)
  assert.deepEqual(passed.run.lines.map(row => [row.expected.en, row.text.en, row.right]), [
    ['true', 'true', true],
    ['true', 'true', true],
    ['false', 'false', true],
  ])
})

test('a comparison board lists the meaning and the translation under test', () => {
  assert.deepEqual(check.board.rows.map((row) => row.name.en), ['Intended meaning', 'Translation under test'])
  assert.equal(check.compare, true)
})

test('a query is checked family by family against what the player expects it to pick', () => {
  const lookup = queryCheck({
    target: 'Parent(ann, x)', notation: {},
    vocab: { names: ['ann', 'bo', 'cy'], consts: [], preds: [['Parent', 2]] },
    worlds: [
      { title: { zh: '第一家', en: 'First' }, things: ['ann', 'bo', 'cy'], preds: { Parent: [['ann', 'bo']] } },
      { title: { zh: '第二家', en: 'Second' }, things: ['ann', 'bo', 'cy'], preds: { Parent: [['ann', 'bo'], ['ann', 'cy']] } },
    ],
  })
  assert.deepEqual(lookup.initial, [[], []])
  assert.deepEqual(lookup.answer, [[1], [1, 2]])
  assert.equal(lookup.judge(lookup.answer), null)
  const wrong = lookup.run([[1], [1]])
  assert.deepEqual(wrong.steps, [{}, { failed: lookup.judge([[1], [1]]).why }])
  assert.deepEqual(wrong.lines.map((line) => line.right), [true, false])
})
