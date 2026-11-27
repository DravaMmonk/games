import assert from 'node:assert/strict'
import { test } from 'node:test'
import { instancesOf, traceOf, worldCheck, worldEdits, worldOf, worldParts } from '../core/worldValues.js'
import { builtWorld } from '../core/fol.js'
import { parse } from '../core/formula.js'
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
    assert.deepEqual(run, { steps: [{ failed: fail.why }], results: [], cases: [] })
  }
})

test('a nonempty world must separate the translations', () => {
  const all = { size: 1, preds: { Likes: ['0,0'] } }
  const rejected = check.report(all)
  assert.deepEqual(rejected.fail, check.judge(all))
  assert.equal(rejected.fail.check, 0)
  assert.deepEqual(rejected.run.steps.at(-1), { sentence: 1, done: true, failed: rejected.fail.why })
  const distinct = { size: 2, preds: { Likes: ['0,0', '1,1'] } }
  assert.equal(check.judge(distinct), null)
  const { steps, results } = check.run(distinct)
  assert.deepEqual(results.map((r) => [r.at, r.text.en, r.right]), [[[0, 0], 'true', undefined], [[1, 0], 'false', true]])
  assert.equal(steps.at(-1).failed, undefined)
})

test('a run reads a sentence a quantifier step at a time and stops as soon as the answer is known', () => {
  const model = builtWorld({ size: 2, preds: { Likes: ['0,0', '1,1'] } }, { preds: [['Likes', 2]], consts: [] })
  const forall = traceOf(parse('∀x. ∃y. Likes(x, y)'), model)
  assert.equal(forall.value, true)
  assert.deepEqual(forall.frames.map((f) => [f.bind, f.atoms.map((a) => a.on)]), [
    [{ x: 0, y: 0 }, [true]],
    [{ x: 1, y: 0 }, [false]],
    [{ x: 1, y: 1 }, [true]],
  ])
  const exists = traceOf(parse('∃y. ∀x. Likes(x, y)'), model)
  assert.equal(exists.value, false)
  assert.deepEqual(exists.frames.map((f) => f.bind), [{ y: 0, x: 0 }, { y: 0, x: 1 }, { y: 1, x: 0 }])
})

test('a world lists every instance of a sentence, and a run marks the ones it reads', () => {
  const model = builtWorld({ size: 2, preds: { Likes: ['0,0', '1,1'] } }, { preds: [['Likes', 2]], consts: [] })
  assert.deepEqual(instancesOf(parse('∃y. ∀x. Likes(x, y)'), model).map((c) => c.bind), [{ y: 0, x: 0 }, { y: 0, x: 1 }, { y: 1, x: 0 }, { y: 1, x: 1 }])
  const { steps, cases } = check.run({ size: 2, preds: { Likes: ['0,0', '1,1'] } })
  assert.deepEqual(cases.map((list) => list.length), [4, 4])
  assert.deepEqual(cases[0][1].text.en, 'Likes(1, 2)')
  // The translation's ∃ gives up on y = 1 after x = 1: its last instance is never read.
  assert.deepEqual(steps.filter((step) => step.sentence === 1 && !step.done).map((step) => step.case), [0, 1, 2])
})

test('a world is edited a fact at a time, and a structure reads back as one', () => {
  const vocab = { preds: [['Bird', 1], ['Likes', 2], ['Rain', 0]], consts: ['h'] }
  let world = { size: 1, preds: {}, consts: {} }
  world = worldEdits.resize(world, 2)
  world = worldEdits.toggle(world, 'Likes', '0,1')
  world = worldEdits.toggle(world, 'Bird', '1')
  world = worldEdits.flip(world, 'Rain')
  world = worldEdits.place(world, 'h', 1)
  assert.deepEqual(worldOf(builtWorld(world, vocab), vocab), { size: 2, preds: { Bird: ['1'], Likes: ['0,1'], Rain: true }, consts: { h: 1 } })
  assert.deepEqual(worldEdits.toggle(world, 'Likes', '0,1').preds.Likes, [])
  const parts = worldParts(vocab, { words: { Bird: { zh: '{0}是鸟', en: '{0} is a bird' }, Likes: { zh: '{0}喜欢{1}', en: '{0} likes {1}' } } })
  assert.deepEqual([parts.props[0].text, parts.rels[0].text], [{ zh: '是鸟', en: 'is a bird' }, { zh: '①喜欢②', en: '① likes ②' }])
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
  assert.deepEqual(failed.run.steps.filter((step) => step.done).map((step) => [step.sentence, Boolean(step.failed)]), [[0, false], [1, true]])
  const passed = inference.report({ size: 1, preds: { Mortal: ['0'] } })
  assert.equal(passed.fail, null)
  assert.deepEqual(passed.run.results.map(row => [row.at, row.text.en, row.right]), [
    [[1, 0], 'true', true],
    [[1, 1], 'true', true],
    [[0, 0], 'false', true],
  ])
})

test('a comparison board lists the meaning and the translation under test', () => {
  assert.deepEqual(check.board.rows.map((row) => row.name.en), ['Intended meaning', 'Translation under test'])
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
