// node --test packages/logic — a lemma's ports are its premises in order.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lemmaPortProblems } from '../core/validate.js'

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

