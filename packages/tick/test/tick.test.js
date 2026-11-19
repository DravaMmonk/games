import { operations } from '../core/registers.js'
// node --test (npm test) — the tick domain: the line's rule, what a level wants tick by tick, a board that talks
// and keeps a register, boards as blueprint text, and its starter game (starter/, what npm run new-game copies)
// passing its own checks.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bitsOf, lineOf } from '../core/line.js'
import { defineParts } from '../../circuit/core/index.js'
import { board } from '../core/board.js'
import { primitivesOnly } from '../../circuit/core/index.js'
import { runLevel } from '../core/run.js'
import { wantOf } from '../core/wants.js'
import { captureWorkshop, publishWorkshop } from '../../workshop/core/workshop.js'
import { workshopView } from '../../workshop/core/workshop-view.js'

const { PARTS } = defineParts({ parts: {
  'sample/reg': { name: 'Register', desc: 'Read a register', icon: 'Box', family: 'memory', settings: { reg: { control: 'text', default: 'A' }, start: { control: 'number', default: 0 } }, op: 'tick/held' },
  'sample/keep': { name: 'Keep', desc: 'Store an input', icon: 'Box', family: 'memory', inputs: [{ name: 'in' }], settings: { reg: { control: 'text', default: 'A' } }, op: 'tick/keep' },
} }, operations)
const plain = primitivesOnly(board, PARTS)
const { fromText, toText } = board
const { partOf } = plain

test('the line is 1 when anyone says 1', () => {
  assert.equal(lineOf([0, 1, undefined]), 1)
  assert.equal(lineOf([0, undefined]), 0)
  assert.deepEqual(bitsOf('01.'), [0, 1, undefined])
})

test('a board keeps a register and says it a tick late', () => {
  const inputs = { b: [1, 0, 1] }
  const level = { talks: true, inputs: [{ name: 'b', label: 'b' }], want: wantOf({ say: { 'tick/delayed': { input: 'b', first: 0 } } }), tests: [{ line: bitsOf('...'), inputs }] }
  const lines = ['r = sample/reg[reg=A, start=0]()', 'k = sample/keep[reg=A](b)', 'say <- r']
  const made = fromText(lines, level, plain)
  const run = runLevel(level, made, partOf)
  assert.equal(run.pass, true)
  assert.deepEqual(run.runs[0].ticks.map((t) => t.said), [0, 1, 0])
  // Written out and read back, a board writes the same text again.
  const text = toText(made, level, plain)
  assert.deepEqual(toText(fromText(text, level, plain), level, plain), text)
  assert.throws(() => fromText(['x = counter(b)'], level, plain), (e) => e.line === 1)
})

test('a blueprint that echoes the same tick fails the authored run with a line-loop diagnostic', () => {
  const level = { listens: true, talks: true, want: wantOf({ say: 'tick/line' }), tests: [{ line: bitsOf('01') }] }
  const result = runLevel(level, fromText(['say <- line'], level, plain), partOf)
  assert.equal(result.pass, false)
  assert.equal(result.runs[0].ticks.length, 0)
  assert.match(result.fail.why.en, /cannot hear before it speaks/)
})

test('a workshop part preserves independent register state for each instance', () => {
  const task = {
    inputs: [{ name: 'a' }, { name: 'b' }],
    outputs: [{ name: 'first' }, { name: 'second' }],
    want: wantOf({
      first: { 'tick/delayed': { input: 'a', first: 0 } },
      second: { 'tick/delayed': { input: 'b', first: 0 } },
    }),
    tests: [{ line: bitsOf('...'), inputs: { a: [1, 0, 1], b: [0, 1, 0] } }],
  }
  const innerTask = { inputs: [{ name: 'value' }], outputs: [{ name: 'out' }] }
  const inner = fromText([
    'r = sample/reg[reg=A, start=0]()',
    'k = sample/keep[reg=A](value)',
    'out <- r',
  ], innerTask, plain)
  const library = { parts: {} }
  const delay = captureWorkshop(inner, {
    parts: board.wiring(innerTask, plain), resolve: partOf, identity: type => type,
    defaults: () => ({}), book: library, scope: 'user_delay',
  })
  const { view, resolve } = workshopView(plain, publishWorkshop(library, delay, { id: delay.id }), () => true, partOf)
  const work = {
    nodes: [...board.fixedOf(task), { id: 'x', type: delay.id }, { id: 'y', type: delay.id }],
    wires: [
      { from: 'a', to: 'x', port: 'value' }, { from: 'b', to: 'y', port: 'value' },
      { from: 'x', to: 'first', port: 'in' }, { from: 'y', to: 'second', port: 'in' },
    ],
  }
  assert.ok(view.board.wiring(task).breaksCycle({ type: delay.id }))
  const result = runLevel(task, work, partOf, { workshopParts: resolve })
  assert.equal(result.pass, true)
  assert.deepEqual(result.runs[0].ticks.map(({ outputs }) => outputs), [
    { first: 0, second: 0 },
    { first: 1, second: 0 },
    { first: 0, second: 1 },
  ])
})
