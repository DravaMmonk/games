// node --test packages/logic — a lemma's ports are its premises in order, and it asks only for the letters they leave open.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lemmaPortProblems } from '../core/validate.js'
import { lemmaLetters } from '../core/work.js'

const proof = (premises, goal) => [{ id: 'base', reference: { kind: 'logic:proof', tests: [{ premises, goal }] } }]
const chain = (extra = {}) => ({
  family: 'logic:family-lemma',
  inputs: [{ name: 'p0', type: 'logic:judgment' }, { name: 'p1', type: 'logic:judgment' }],
  inside: proof({ p: 'A → B', q: 'B → C' }, 'A → C'),
  ...extra,
})

test('a lemma with one port per premise is fine', () => {
  assert.deepEqual(lemmaPortProblems({ chain: chain() }), [])
  // An axiom has no premises: every letter is open, so it asks for them all.
  assert.deepEqual(lemmaPortProblems({ axK: { inputs: [], settings: { A: {}, B: {} }, inside: proof({}, 'A → (B → A)') } }), [])
})

test('a lemma whose ports and premises differ in number is reported', () => {
  const [problem] = lemmaPortProblems({ chain: chain({ inputs: [{ name: 'p0' }] }) })
  assert.match(problem.text, /chain: 1 port\(s\) \(p0\), but the proof inside it \(base\) has 2 premise\(s\) \(p, q\)/)
})

test('a lemma asking for a letter its premises fix is reported, shape by shape', () => {
  const [problem] = lemmaPortProblems({ chain: chain({ settings: { A: { control: 'tree' }, C: { control: 'tree' } } }) })
  assert.match(problem.text, /chain: its premises fix A, C/)
  // A letter some shape leaves open may be asked for; `form` is not a letter.
  const shapes = [...proof({ p: 'A' }, 'A ∨ B'), { id: 'other', reference: { kind: 'logic:proof', tests: [{ premises: { p: 'A ∧ B' }, goal: 'A' }] } }]
  assert.deepEqual(lemmaPortProblems({ orI: { inputs: [{ name: 'p0' }], settings: { B: {}, form: {} }, inside: shapes } }), [])
})

test("a lemma's letters are those its proof tasks write, predicates included", () => {
  const notEx = { tests: [{ premises: { p: '¬∃x. P(x)' }, goal: '∀x. ¬P(x)' }] }
  const notOr = { tests: [{ premises: { p: '¬(A ∨ B)' }, goal: '¬A ∧ ¬B' }] }
  assert.deepEqual(lemmaLetters([notOr, notEx]), ['A', 'B', 'P'])
  assert.deepEqual(lemmaLetters([{ tests: [{ goal: 'A → (B → A)' }] }]), ['A', 'B'])
})
