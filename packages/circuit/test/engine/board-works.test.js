import { withProgressFixture } from '../../../qed/test/fixture.js'
// node --test (npm test) — what a task on the circuit preset holds (board-works.js over ../course.js holds): a part,
// one of its settings, one value of a setting, by the course's progress and by what the task gives or withholds.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkCircuitTasks } from '../../core/circuit-preset.js'
import { definedWorks } from '../../core/board-works.js'
import { flowBoard } from '../../core/board-cards.js'
import { S } from "../../../../games/kit/engine/schema.js"
import { onceRun } from '../../core/circuit-run.js'

const text = (zh) => ({ zh })
const OPS = {
  calc: { args: [{ name: 'a' }, { name: 'b' }], params: S.obj({ how: S.oneOf(['plus', 'minus'], { default: 'plus' }) }), run: ([a, b], { how }) => how === 'minus' ? a - b : a + b },
}
// One part of two ways: `how` picks adding or subtracting.
const partDefs = { parts: { calc: {
  name: text('算'), desc: text('算两个数'), icon: 'Plus', family: 'value', inputs: [{ name: 'a' }, { name: 'b' }],
  settings: { 'how': { control: 'select', label: text('怎么算'), default: 'plus', options: [{ value: 'plus', label: text('加') }] } },
  op: 'calc',
  stages: [{ id: 'calc-minus', settings: { how: { options: [{ value: 'plus' }, { value: 'minus' }] } } }],
} } }
const ports = { inputs: [{ name: 'a', label: text('a') }, { name: 'b', label: text('b') }], outputs: [{ name: 'out', label: text('结果') }] }
const sums = [{ inputs: { a: 5, b: 3 }, expect: { out: 8 } }, { inputs: { a: 1, b: 1 }, expect: { out: 2 } }]
const differences = [{ inputs: { a: 5, b: 3 }, expect: { out: 2 } }, { inputs: { a: 1, b: 4 }, expect: { out: -3 } }]
const task = (id, tests, how, more = {}) => ({ id, brief: text(id), ...ports, tests, solution: [`c = calc[how=${how}](a, b)`, 'out <- c'], ...more })
const level = (id, tasks, more = {}) => [id, { title: text(id), tasks, ...more }]
const course = (levels, definitions = partDefs) => definedWorks(withProgressFixture({
  id: 't',
  ...{ vocabulary: 1, title: text('t'), kicker: text('t'), lede: text('t'), registries: { tag: { 'circuit/part:circuit/primitives': { kind: 'circuit/part', values: ['calc'] } } }, eras: [{ id: 1, title: text('一'), question: text('？'), levels: levels.map(([id]) => ({ id })), links: levels.slice(1).map(([to], i) => ({ from: levels[i][0], to })) }] },
  levels: levels.map(([id, value]) => ({ id, ...value })),
  glossary: { groups: [], entries: [] },
  partDefs: definitions,
}), { board: flowBoard(), ops: OPS })
const { runLevel, entries } = onceRun({})
const reports = (read) => checkCircuitTasks(read, { run: runLevel, entries })
const failures = (read) => reports(read).filter((line) => line.fail).map((line) => line.text)

test('a value a task opens is held from there on, and not before; a value nothing opens is held from the start', () => {
  const read = course([
    level('one', [task('one', sums, 'plus')], { adds: ['calc'] }),
    level('two', [task('two-a', sums, 'plus'), task('two-b', differences, 'minus', { opens: ['calc-minus'] })]),
    level('three', [task('three', differences, 'minus')]),
  ])
  assert.deepEqual(read.wrong, [])
  const has = (id, k) => read.holdsIn(read.played.get(id)[k], [])
  assert.deepEqual([has('one', 0), has('two', 0), has('two', 1), has('three', 0)].map((h) => [h('calc'), h('calc', 'how', 'plus'), h('calc', 'how', 'minus')]), [[true, true, false], [true, true, false], [true, true, true], [true, true, true]])
  assert.deepEqual(reports(read), [
    { level: 'one', fail: false, text: 'one one: answer PASS (2 tests)' },
    { level: 'two', fail: false, text: 'two two: task two-a: answer PASS (2 tests) · task two-b: answer PASS (2 tests)' },
    { level: 'three', fail: false, text: 'three three: answer PASS (2 tests)' },
  ])
})

test('a task gives and withholds a value for itself alone, and its answer keeps to what it holds', () => {
  const levels = (two, three) => [
    level('one', [task('one', sums, 'plus')], { adds: ['calc'] }),
    level('two', [two]),
    level('three', [three], { tasks: [{ ...three, opens: ['calc-minus'] }] }),
    level('four', [task('four', differences, 'minus')]),
  ]
  const read = course(levels(task('two', differences, 'minus', { gives: ['calc-minus'] }), task('three', differences, 'minus')))
  const has = (id) => read.holdsIn(read.played.get(id)[0], [])
  // Two is given the way to subtract before three brings it in; one has not got it.
  assert.deepEqual(['one', 'two', 'three', 'four'].map((id) => has(id)('calc', 'how', 'minus')), [false, true, true, true])
  assert.deepEqual(failures(read), [])
  // A task cannot use a value opened by a later task of its own level.
  const premature = course([
    level('one', [task('one', sums, 'plus')], { adds: ['calc'] }),
    level('two', [task('two-a', differences, 'minus'), task('two-b', differences, 'minus', { opens: ['calc-minus'] })]),
  ])
  assert.match(failures(premature).join('\n'), /two: .*sets calc’s how to minus, which the level does not hold/)
  const kept = course([...levels(task('two', sums, 'plus'), task('three', differences, 'minus')).slice(0, 3), level('four', [task('four', sums, 'plus', { withholds: ['calc-minus'] })])])
  assert.deepEqual([kept.holdsIn(kept.played.get('four')[0], [])('calc', 'how', 'minus'), kept.holdsIn(kept.played.get('four')[0], [])('calc', 'how', 'plus')], [false, true])
  assert.deepEqual(failures(kept), [])
})

test('a packaged circuit runs even when no task publishes it', () => {
  const reference = { ...ports, solution: ['c = calc[how=plus](a, b)', 'out <- c'] }
  const read = course([
    level('one', [task('one', sums, 'plus', { solution: ['w = wrapped(a, b)', 'out <- w'], results: [{ of: 'out' }] })], { adds: ['calc', 'wrapped'] }),
  ], { ...partDefs, parts: { ...partDefs.parts, wrapped: { name: text('wrapped'), desc: text('wrapper'), inside: [{ id: 'base', reference }] } } })
  assert.deepEqual(read.wrong, [])
  const outputs = []
  const lines = checkCircuitTasks(read, { run: runLevel, entries: sample => {
    outputs.push(sample.run.outputs.out)
    return entries(sample)
  } })
  assert.deepEqual(lines, [{ level: 'one', fail: false, text: 'one one: answer PASS (2 tests)' }])
  assert.deepEqual(outputs, [8])
  assert.equal(read.builtBy('wrapped'), null)
})

test('passing starters and hidden publication failures are reported without replay traces', () => {
  const reference = { ...ports, solution: ['out <- a'] }
  const read = course([
    level('one', [task('one', [{ inputs: { a: 2, b: 0 }, expect: { out: 2 } }], 'plus', {
      hidden: [sums[0]], publishes: [{ part: 'wrapped', variant: 'base' }],
      starter: ['c = calc[how=plus](a, b)', 'out <- c'],
    })], { adds: ['calc'] }),
  ], { ...partDefs, parts: { ...partDefs.parts, wrapped: { name: text('wrapped'), inside: [{ id: 'base', reference }] } } })
  const lines = checkCircuitTasks(read, {
    run: (...args) => {
      const result = runLevel(...args)
      assert.ok(result.runs.length)
      assert.ok(result.runs.every(run => !Object.hasOwn(run, 'trace')))
      return result
    },
    entries: () => assert.fail('no explicit result rows need validation'),
  })
  assert.deepEqual(lines, [{
    level: 'one', fail: true, text: 'one one: the board it opens on passes; its part wrapped alone fails hidden test 1',
  }])
})
