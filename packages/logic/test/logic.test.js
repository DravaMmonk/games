import { logicParts } from './part-fixture.js'
// node --test packages/logic/test — formulas, rules as parts, boxes, and countermodels. Boards are written short,
// by the helpers below.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkIso, declaredRules, derives, follows } from '../core/iso.js'
import { auditCaseProblems, restoreAuditCases, runAudit } from '../core/audit-cases.js'
import { ASSUMPTION_RULE, parseSide, ruleOf, ruleText, unify } from '../core/schematic.js'
import { checkDefine } from '../core/define.js'
import { failureText } from '../../../games/kit/engine/failure-text.js'
import { checkDeclaration, linesOf, premiseChips, problemsOf, readRuleRows } from '../core/ruleLines.js'
import { bin, parse, same, show, subst, substMany, tvar } from '../core/formula.js'
import { render } from '../core/notation.js'
import { didText, machineGeneralNotation, machineReadout, stepExplained } from '../core/circuit-readouts.js'
import { countermodel, countermodelSearch, holds } from '../core/models.js'
import { BACKWARD_POSITIONS, MACHINE_BOARD, REWRITE_CHOICES, RULE_CHOICES, boardRules, builtMachine, defaultBoundRule, directCardsOf, inputsOfLevel, machineConfigurationCases, machinePositionCases, runMachine } from '../core/machine.js'
import { compileParts } from 'circuit'
import { OPS } from '../core/ops.js'
import { OPTIONS, PROOF_BOARD, RULES, lemmaGives, proved, runProof } from '../core/proof.js'
import { partsOf } from '../core/ops.js'
import { printTerm } from '../core/pterm.js'
import { boxNames, followNames, pickableAt } from '../core/names.js'
import { validate } from '../core/validate.js'

test('proof inputs have a goal label while specialised inputs keep their names', () => {
  assert.deepEqual(inputsOfLevel({}), [{ name: 'in', label: { zh: '目标', en: 'Goal' } }])
  const inputs = [{ name: 'in', label: { zh: '子句', en: 'Clauses' } }, { name: 'extra', label: { zh: '额外输入', en: 'Extra input' } }]
  assert.deepEqual(inputsOfLevel({ inputs }), inputs)
})

// Proofs use the operation fixtures together with their local lemmas.
const proofParts = (lemmas) => ({ ...PROOF_BOARD.FIXED_PARTS, ...partsOf(logicParts, lemmas).PARTS })
const run = (level, circuit) => runProof({ parts: proofParts(level.lemmas), ...level }, circuit)
// A machine runs on the tactic and loop fixtures and the task's bound cards.
const defined = partsOf(logicParts)
const MACHINE_ONLY = Object.fromEntries(Object.entries(defined.PARTS).filter(([type]) => ['logic/tactic', 'logic/loop'].includes(defined.defs[type].family)))
const machineParts = (type) => MACHINE_BOARD.FIXED_PARTS[type] ?? MACHINE_ONLY[type]
const onMachine = (fields) => {
  const task = { directRuleCards: true, ...fields }
  const { PARTS } = compileParts(Object.fromEntries([...directCardsOf(task)].map(([type, card]) => [type, card.definition])), OPS)
  task.parts = type => PARTS[type] ?? machineParts(type)
  return task
}
const CITE = 'logic/directBackward-logic_assumption'

/* ---------- boards written short ---------- */

// A card is { id: [type, settings?, where?] }: `where` is the box region it sits in ('f' for a box's only region,
// 'e/left' for one of several), the board itself when left out. A wire is 'from>to.port' ('from>goal' into the goal);
// a box's assumption is the source '<box>#<region>', and what a region proves goes into the box's port of that name.
const wiresOf = (wires) => wires.map((w) => {
  const [from, to] = w.split('>')
  const [id, port = 'in'] = to.split('.')
  return { from, to: id, port }
})
const cardsOf = (nodes, registry) => Object.entries(nodes).map(([id, [type, params = {}, where]]) => ({
  id, type, params, ...(where ? { in: where.includes('/') ? where : `${where}/${registry[nodes[where][0]].frames({ params: nodes[where][1] ?? {} })[0].name}` } : {}),
}))
/** A proof of a level's goal from its premises. */
const proof = (nodes, wires, { premises = [] } = {}) => ({
  nodes: [...premises.map((name) => ({ id: name, type: 'premise', params: { name } })), ...cardsOf(nodes, proofParts()), { id: 'goal', type: 'goal', params: { name: 'goal' } }],
  wires: wiresOf(wires),
})
/** A machine board: its inputs (named), the cards, and the result `out`. */
const machine = (nodes, wires, { inputs = ['in'] } = {}) => ({
  nodes: [...inputs.map((name) => ({ id: name, type: 'in', params: { name } })), ...cardsOf(nodes, MACHINE_ONLY), { id: 'out', type: 'out', params: { name: 'out' } }],
  wires: wiresOf(wires),
})
/** A declaration of ways each needing these sentences (a sentence needed under others: [sentence, …those]). */
const declaration = (...ways) => ways.map((needs) => ({ binds: [], needs }))
/** A lemma's shape as a course proves it (course.js lemmaProofs): the proof task (`schema` in letters, its title, its
 *  words) and the board it was passed with. */
const provenBy = (schema, board, extra = {}) => ({ level: { id: 'builder', title: { zh: '证明', en: 'Proof' }, schema, tests: [schema], ...extra }, board: () => board })
// K and S as a course proves them (lemmas of the kernel, no longer axioms), each running its proof.
const KS = { axK: { statement: 'A → (B → A)', metas: ['A', 'B'] }, axS: { statement: '(A → (B → C)) → ((A → B) → (A → C))', metas: ['A', 'B', 'C'] } }
const KS_PROOFS = {
  axK: { '': provenBy({ goal: 'A → (B → A)' }, proof({ f: ['impI', { A: 'A' }], g: ['impI', { A: 'B' }, 'f'] }, ['f#body>g.body', 'g>f.body', 'f>goal'])) },
  axS: { '': provenBy({ goal: '(A → (B → C)) → ((A → B) → (A → C))' }, proof({
    f: ['impI', { A: 'A → (B → C)' }], g: ['impI', { A: 'A → B' }, 'f'], h: ['impI', { A: 'A' }, 'g'], m1: ['mp', {}, 'h'], m2: ['mp', {}, 'h'], m3: ['mp', {}, 'h'],
  }, ['f#body>m1.imp', 'h#body>m1.a', 'g#body>m2.imp', 'h#body>m2.a', 'm1>m3.imp', 'm2>m3.a', 'm3>h.body', 'h>g.body', 'g>f.body', 'f>goal'])) },
}

test('parse and show round-trip with the usual precedence', () => {
  for (const text of ['A → B → C', '(A → B) → C', 'A ∧ B ∨ C', 'A ∧ (B ∨ C)', '¬¬A', '∀x. P(x) → ∃y. Q(x, y)', 'f(a) = b']) {
    const f = parse(text, { consts: ['a', 'b'] })
    assert.ok(same(parse(show(f), { consts: ['a', 'b'] }), f), text)
  }
  assert.equal(show(parse('A -> B -> C')), 'A → B → C')
  assert.equal(show(parse('(A -> B) -> C')), '(A → B) → C')
})

test('substitution does not capture', () => {
  const f = parse('∀y. P(x, y)')
  assert.equal(show(subst(f, 'x', tvar('y'))), '∀y1. P(y, y1)')
})

test('Hilbert: A → A from K and S in five steps', () => {
  const level = { tests: [{ goal: 'A → A' }], lemmas: KS, proofs: KS_PROOFS }
  const c = proof({
    s: ['axS', { A: 'A', B: 'A → A', C: 'A' }],
    k1: ['axK', { A: 'A', B: 'A → A' }],
    m1: ['mp'],
    k2: ['axK', { A: 'A', B: 'A' }],
    m2: ['mp'],
  }, ['s>m1.imp', 'k1>m1.a', 'm1>m2.imp', 'k2>m2.a', 'm2>goal'])
  const r = run(level, c)
  assert.equal(r.pass, true, JSON.stringify(r.runs[0].checks))
  assert.equal(r.score.steps, 5)
})

test('a wrong premise is named with what it needed', () => {
  const level = { tests: [{ premises: { p: 'A → B', q: 'C' }, goal: 'B' }] }
  const c = proof({ m: ['mp'] }, ['p>m.imp', 'q>m.a', 'm>goal'], { premises: ['p', 'q'] })
  const r = run(level, c)
  assert.equal(r.pass, false)
  assert.deepEqual(r.runs[0].errors.get('m'), { zh: '这里要 A，接进来的是 C', en: 'This needs A; it got C' })
})

test('→ introduction closes its assumption; an open one fails', () => {
  const level = { tests: [{ goal: 'A → B → A' }], lemmas: KS, proofs: KS_PROOFS }
  // The outer box assumes A; inside it, K and Apply give B → A from it.
  const good = proof({ i: ['impI', { A: 'A' }], k: ['axK', { A: 'A', B: 'B' }, 'i'], m: ['mp', {}, 'i'] }, ['k>m.imp', 'i#body>m.a', 'm>i.body', 'i>goal'])
  assert.equal(run(level, good).pass, true)
  // The same goal with two boxes, the inner one handing back the outer box's assumption.
  assert.equal(run(level, proof({ i: ['impI', { A: 'A' }], j: ['impI', { A: 'B' }, 'i'] }, ['i#body>j.body', 'j>i.body', 'i>goal'])).pass, true)
  // Handing back the inner box's own assumption proves A → B → B, not the goal.
  assert.equal(run(level, proof({ i: ['impI', { A: 'A' }], j: ['impI', { A: 'B' }, 'i'] }, ['j#body>j.body', 'j>i.body', 'i>goal'])).pass, false)
  // An assumption taken out of its box stays open: the goal reached that way does not count.
  const leak = { tests: [{ goal: 'A' }] }
  const r = run(leak, proof({ i: ['impI', { A: 'A' }] }, ['i#body>goal']))
  assert.equal(r.pass, false)
  assert.match(r.runs[0].checks[0].reason.en, /still open/)
})

test('a box reads back what was made from its own assumption', () => {
  const level = { tests: [{ premises: { p: 'A → B' }, goal: 'A → B' }] }
  assert.equal(run(level, proof({ i: ['impI', { A: 'A' }], m: ['mp', {}, 'i'] }, ['p>m.imp', 'i#body>m.a', 'm>i.body', 'i>goal'], { premises: ['p'] })).pass, true)
})

test('∨ elimination needs both cases to agree', () => {
  const level = { tests: [{ premises: { p: 'A ∨ B' }, goal: 'B ∨ A' }] }
  const both = proof({ e: ['orE'], l: ['orI', { other: 'B', side: 'left' }, 'e/left'], r: ['orI', { other: 'A', side: 'right' }, 'e/right'] }, ['p>e.ab', 'e#left>l.a', 'l>e.left', 'e#right>r.a', 'r>e.right', 'e>goal'], { premises: ['p'] })
  assert.equal(run(level, both).pass, true)
  const apart = proof({ e: ['orE'], l: ['orI', { other: 'B', side: 'right' }, 'e/left'], r: ['orI', { other: 'A', side: 'right' }, 'e/right'] }, ['p>e.ab', 'e#left>l.a', 'l>e.left', 'e#right>r.a', 'r>e.right', 'e>goal'], { premises: ['p'] })
  assert.match(run(level, apart).runs[0].errors.get('e').en, /different/)
})

test('a box takes the first name nothing around it uses', () => {
  const binds = (node) => node.type === 'box'
  const nodes = [
    { id: 'g', type: 'box' }, { id: 'e', type: 'box', in: 'g/body' }, { id: 's', type: 'box' },
    { id: 'h', type: 'impI', params: { A: 'P(a)' } }, { id: 'i', type: 'box', in: 'h/body' },
  ]
  assert.deepEqual(boxNames({ nodes }, binds), { g: 'a', e: 'b', s: 'a', i: 'b' })
  assert.deepEqual(boxNames({ nodes }, binds, ['a']), { g: 'b', e: 'c', s: 'b', i: 'b' })
  // A premise's name is no arbitrary thing: the for-any box takes another, and generalises nothing.
  const level = { tests: [{ premises: { p: 'P(a)' }, goal: '∀x. P(x)' }] }
  const r = run(level, proof({ g: ['allI'] }, ['p>g.body', 'g>goal'], { premises: ['p'] }))
  assert.equal(r.pass, false)
  assert.equal(show(r.runs[0].outputs.goal.formula), '∀x. P(a)')
})

test('a card picks only the things in scope where it sits', () => {
  const binds = (node) => node.type === 'box'
  const nodes = [
    { id: 'g', type: 'box' }, { id: 'e', type: 'box', in: 'g/body' }, { id: 'u', type: 'allE', in: 'e/body' },
    { id: 's', type: 'box' }, { id: 'v', type: 'allE', in: 's/body' }, { id: 'w', type: 'allE' },
  ]
  assert.deepEqual(pickableAt(['zero', 'a', 's(b)'], { nodes }, nodes[2], binds), ['zero', 'a', 's(b)', 'b'])
  assert.deepEqual(pickableAt(['zero', 'a', 's(b)'], { nodes }, nodes[4], binds), ['zero', 'a'])
  assert.deepEqual(pickableAt(['zero'], { nodes }, nodes[2], binds), ['zero', 'a', 'b'])
  // Outside every box, a name a box takes is out of reach; one the level's sentences use is not.
  assert.deepEqual(pickableAt(['zero', 'a', 'b'], { nodes }, nodes[5], binds), ['zero'])
  assert.deepEqual(pickableAt(['zero', 'a', 'b'], { nodes }, nodes[5], binds, ['a']), ['zero', 'a'])
})

test('cards inside a moved box follow the name it takes', () => {
  const binds = (node) => node.type === 'box'
  const before = { nodes: [
    { id: 'g', type: 'box' }, { id: 'e', type: 'box' },
    { id: 'u', type: 'allE', in: 'e/body', params: { t: 'a' } }, { id: 'h', type: 'impI', in: 'e/body', params: { A: 'P(a) & Q(b)' } },
  ] }
  const moved = { nodes: before.nodes.map((node) => (node.id === 'e' ? { ...node, in: 'g/body' } : node)) }
  const after = followNames(before, moved, binds)
  assert.deepEqual(after.nodes.map((node) => node.params), [undefined, undefined, { t: 'b' }, { A: 'P(b) & Q(b)' }])
  assert.equal(followNames(before, before, binds), before)
  // A board put in place of another keeps the names it was written with.
  const other = { nodes: moved.nodes.map((node) => (node.id === 'u' ? { ...node, params: { t: 'b' } } : node)) }
  assert.equal(followNames(before, other, binds), other)
})

// Chain as chapter 2 proves it: A → C from A → B and B → C, and the proof of A → A.
const CHAIN = { chain: { name: { zh: '串联', en: 'Chain' }, statement: 'A → C', premises: ['A → B', 'B → C'], metas: ['A', 'B', 'C'] }, id: { statement: 'A → A', metas: ['A'] } }
const chainProof = proof({ f: ['impI', { A: 'A' }], m1: ['mp', {}, 'f'], m2: ['mp', {}, 'f'] }, ['p>m1.imp', 'f#body>m1.a', 'q>m2.imp', 'm1>m2.a', 'm2>f.body', 'f>goal'], { premises: ['p', 'q'] })
const chainBy = (board) => ({ chain: { '': provenBy({ premises: { p: 'A → B', q: 'B → C' }, goal: 'A → C' }, board) }, id: { '': provenBy({ goal: 'A → A' }, proof({ f: ['impI', { A: 'A' }] }, ['f#body>f.body', 'f>goal'])) } })
const useChain = proof({ c: ['chain'] }, ['p>c.p0', 'q>c.p1', 'c>goal'], { premises: ['p', 'q'] })

test('a lemma with premises: what is wired in fixes its letters, the card the rest', () => {
  const level = { lemmas: CHAIN, proofs: chainBy(chainProof), tests: [{ premises: { p: 'P → Q', q: 'Q → R' }, goal: 'P → R' }] }
  assert.equal(run(level, useChain).pass, true)
  const wrong = run(level, proof({ c: ['chain'] }, ['q>c.p0', 'p>c.p1', 'c>goal'], { premises: ['p', 'q'] }))
  assert.equal(wrong.pass, false)
  const one = { lemmas: CHAIN, proofs: level.proofs, tests: [{ goal: 'P ∧ Q → P ∧ Q' }] }
  assert.equal(run(one, proof({ i: ['id', { A: 'P ∧ Q' }] }, ['i>goal'])).pass, true)
})

test('a lemma runs the proof that proved it, with its letters filled in, and its term is still its name', () => {
  const level = { lemmas: CHAIN, tests: [{ premises: { p: 'Rain ∨ Wind → Wet', q: 'Wet → Slip' }, goal: 'Rain ∨ Wind → Slip' }] }
  // The player's own proof, another way round (a detour through ∧), is what the card runs: it proves the same.
  const detour = proof({ f: ['impI', { A: 'A' }], m1: ['mp', {}, 'f'], both: ['andI', {}, 'f'], e: ['andE', {}, 'f'], m2: ['mp', {}, 'f'] }, ['p>m1.imp', 'f#body>m1.a', 'm1>both.a', 'm1>both.b', 'both>e.ab', 'q>m2.imp', 'e#left>m2.a', 'm2>f.body', 'f>goal'], { premises: ['p', 'q'] })
  for (const board of [chainProof, detour]) {
    const r = run({ ...level, proofs: chainBy(board) }, useChain)
    assert.equal(r.pass, true, JSON.stringify(r.runs[0].checks))
    assert.equal(printTerm(r.runs[0].outputs.goal.term), 'chain p q')
  }
  // A kept proof that proves something else (A → B, from the first premise alone) gives nothing, and says whose proof.
  const other = proof({ f: ['impI', { A: 'A' }], m1: ['mp', {}, 'f'] }, ['p>m1.imp', 'f#body>m1.a', 'm1>f.body', 'f>goal'], { premises: ['p', 'q'] })
  const r = run({ ...level, proofs: chainBy(other) }, useChain)
  assert.equal(r.pass, false)
  assert.match(r.runs[0].errors.get('c').zh, /^「串联」照「证明」一关的证明来证，在这里证不出：证出的是「Rain ∨ Wind → Wet」/)
  // So does a lemma with no proof.
  assert.match(run({ ...level, proofs: {} }, useChain).runs[0].errors.get('c').en, /has no proof/)
})

test('a proof that does not hold for an instance of its letters gives nothing there', () => {
  // ¬∃x. P ⟹ ∀x. ¬P, proved with the thing taken named a: where the property speaks of some a (a variable, as inside
  // a for-any box), that a is not arbitrary.
  const lemmas = { qdm: { name: { zh: '量词德摩根', en: 'Quantifier De Morgan' }, statement: '∀x. ¬P', premises: ['¬∃x. P'], metas: ['P'] } }
  const board = proof({ g: ['allI'], f: ['impI', { A: 'P(a)' }, 'g'], i: ['exI', {}, 'g/body'], m: ['mp', {}, 'g/body'] }, ['f#body>i.a', 'p>m.imp', 'i>m.a', 'm>f.body', 'f>g.body', 'g>goal'], { premises: ['p'] })
  const proofs = { qdm: { '': provenBy({ premises: { p: '¬∃x. P(x)' }, goal: '∀x. ¬P(x)' }, board) } }
  const use = proof({ c: ['qdm'] }, ['p>c.p0', 'c>goal'], { premises: ['p'] })
  const at = (premise, goal) => run({ lemmas, proofs, tests: [{ premises: { p: premise }, goal }] }, use)
  assert.equal(at('¬∃y. Loves(y, b)', '∀y. ¬Loves(y, b)').pass, true)
  const clash = at('¬∃y. Loves(y, a)', '∀y. ¬Loves(y, a)')
  assert.equal(clash.pass, false)
  assert.match(clash.runs[0].errors.get('c').en, /runs the proof from “Proof”, which does not prove it here: a occurs in the open hypothesis/)
})

test('countermodels: Peirce has none classically, (A → B) → A has one, the quantifier swap has one', () => {
  assert.equal(countermodel([], parse('((A → B) → A) → A')), null)
  const m = countermodel([], parse('(A → B) → A'))
  assert.equal(m.preds.A, false)
  const swap = countermodelSearch([parse('∀x. ∃y. R(y, x)')], parse('∃y. ∀x. R(y, x)'))
  assert.equal(swap.size, 2)
  assert.ok(holds(parse('∀x. ∃y. R(y, x)'), swap.model))
  assert.ok(!holds(parse('∃y. ∀x. R(y, x)'), swap.model))
})

test('mixed countermodel search keeps the first witness and skips domains over its limit', () => {
  const options = { consts: ['a'] }
  const premises = ['P(a)', 'f(a) = a'].map(text => parse(text, options))
  const goal = parse('∀x. f(x) = a', options)
  assert.deepEqual(countermodelSearch(premises, goal, { limit: 31 }), { model: null, searched: [1] })
  assert.deepEqual(countermodelSearch(premises, goal, { limit: 32 }), {
    model: { domain: [0, 1], preds: { P: new Set(['0']) }, fns: { a: new Map([['', 0]]), f: new Map([['0', 0], ['1', 1]]) } },
    size: 2,
    searched: [1],
  })
})

test('the domain check runs reference and naive proofs', () => {
  const s = proof({ m: ['mp'] }, ['p>m.imp', 'q>m.a', 'm>goal'], { premises: ['p', 'q'] })
  const level = { id: 'mp', kind: 'logic/proof', title: 'mp', tests: [{ premises: { p: 'A → B', q: 'A' }, goal: 'B' }], solution: s, parts: proofParts() }
  const lines = (naive) => validate({ levels: [{ id: 'mp', tasks: [{ ...level, task: 0, naive }] }], logic: { wrong: [] } })
  const reference = { level: 'mp', fail: false, text: 'mp mp: solution PASS [1 steps]' }
  assert.deepEqual(lines(proof({}, ['q>goal'], { premises: ['p', 'q'] })), [
    reference, { level: 'mp', fail: false, text: '  naive fails' },
  ])
  assert.deepEqual(lines(s), [reference, { level: 'mp', fail: true, text: '  naive PASSES (bad)' }])
})

test('one-step lemma checks require every case and respect a requested proof term', () => {
  const solution = proof({ m: ['mp'] }, ['p>m.imp', 'q>m.a', 'm>goal'], { premises: ['p', 'q'] })
  const lemmas = { applyB: { statement: 'B', premises: ['A → B', 'A'] } }
  const course = { availableParts: () => ['mp', 'applyB'], builder: () => null }
  const first = { premises: { p: 'A → B', q: 'A' }, goal: 'B' }
  const second = { premises: { p: 'A → C', q: 'A' }, goal: 'C' }
  const lines = tests => validate({
    levels: [{ id: 'mp', tasks: [{ id: 'mp', kind: 'logic/proof', title: 'mp', task: 0, tests, solution, lemmas, parts: proofParts() }] }],
    course, logic: { wrong: [] },
  }).filter(line => line.fail)
  assert.deepEqual(lines([first]), [{ level: 'mp', fail: true, text: 'mp: the lemma applyB it carries proves it in one step' }])
  assert.deepEqual(lines([first, second]), [])
  assert.deepEqual(lines([first, { ...first, term: 'p q' }]), [])
})

test('a lemma gives a goal in one step only when the givens fit its premises', () => {
  const chain = { statement: 'A → C', premises: ['A → B', 'B → C'], metas: ['A', 'B', 'C'] }
  assert.equal(lemmaGives(chain, [parse('Q → R'), parse('P → Q')], parse('P → R')), true)
  assert.equal(lemmaGives(chain, [parse('P → (Q → R)'), parse('Q')], parse('P → R')), false)
})

test('proof terms: parsed, printed and compared', async () => {
  const { parseTerm, printTerm, alphaEq } = await import('../core/pterm.js')
  const t = parseTerm('fun p => p.elim (fun a => Or.inr a) (fun b => Or.inl b)')
  assert.equal(printTerm(t), 'fun p => p.elim (fun a => Or.inr a) (fun b => Or.inl b)')
  assert.ok(alphaEq(parseTerm('fun x y => x'), parseTerm('fun a b => a')))
  assert.ok(!alphaEq(parseTerm('fun x y => x'), parseTerm('fun a b => b')))
})

test('formulas built from chips: holes in reading order, parts taken out whole', async () => {
  const { chipsOf, complete, holesOf, kindAt, missingChips, setAt } = await import('../core/formulaTree.js')
  const level = { kind: 'logic/translate', consts: ['soc'], vocab: { preds: [['Mortal', 1], ['Human', 1]], consts: ['soc'] }, notation: { symbols: ['∀'] } }
  const chips = new Map(chipsOf(level).map((c) => [c.key, c]))
  const put = (tree, key) => setAt(tree, holesOf(tree).find((h) => h.kind === chips.get(key).kind).path, chips.get(key).make())
  let tree = ['∀x', '→', 'P:Human', 'v:x', 'P:Mortal', 'v:x'].reduce(put, null)
  assert.ok(complete(tree))
  assert.ok(same(tree, parse('∀x. Human(x) → Mortal(x)')))
  assert.equal(kindAt(tree, [0, 0, 0]), 'term')
  tree = setAt(tree, [0, 0], null)
  assert.deepEqual(holesOf(tree), [{ path: [0, 0], kind: 'formula' }])
  assert.deepEqual(missingChips(parse('∃x. Human(x)'), [...chips.values()]), ['∃x'])
})

test('a connective put after a whole sentence takes it as its first side', async () => {
  const { chipsOf, holesOf, setAt, nodeAt } = await import('../core/formulaTree.js')
  const { sentenceLanguage } = await import('../core/sentenceLanguage.js')
  const level = { kind: 'logic/translate', consts: [], vocab: { preds: [['Mortal', 1], ['Human', 1]], consts: [] }, notation: { symbols: ['∀'] } }
  const chips = new Map(chipsOf(level).map((c) => [c.key, c]))
  const { joinsOnto } = sentenceLanguage(level.notation)
  const target = (tree, op) => joinsOnto(tree, chips.get(op), chips.get(op).make())
  const fill = (tree, key) => setAt(tree, holesOf(tree).find((h) => h.kind === chips.get(key).kind).path, chips.get(key).make())
  let tree = ['∀x', 'P:Human', 'v:x'].reduce(fill, null)
  const join = (t, op) => { const at = target(t, op); return setAt(t, at, setAt(chips.get(op).make(), [0], nodeAt(t, at))) }
  assert.deepEqual(target(tree, '→'), [0])
  tree = ['P:Mortal', 'v:x'].reduce(fill, join(tree, '→'))
  assert.ok(same(tree, parse('∀x. Human(x) → Mortal(x)')))
  assert.equal(target(['∀x', 'P:Human'].reduce(fill, null), '→'), null)
  // A ∧ B then → takes A ∧ B; A → B then → takes only B.
  const ab = ['∧', 'P:Human', 'v:x', 'P:Mortal', 'v:x'].reduce(fill, null)
  assert.ok(same(['P:Human', 'v:x'].reduce(fill, join(ab, '→')), parse('Human(x) ∧ Mortal(x) → Human(x)')))
  const ib = ['→', 'P:Human', 'v:x', 'P:Mortal', 'v:x'].reduce(fill, null)
  assert.ok(same(['P:Human', 'v:x'].reduce(fill, join(ib, '→')), parse('Human(x) → (Mortal(x) → Human(x))')))
})

test('a thing put where a sentence goes waits for a predicate to take it', async () => {
  const { chipsOf, holesOf, setAt, nodeAt, straysOf } = await import('../core/formulaTree.js')
  const { sentenceLanguage } = await import('../core/sentenceLanguage.js')
  const level = { kind: 'logic/translate', consts: ['ann', 'bo'], vocab: { preds: [['Parent', 2]], consts: ['ann', 'bo'] }, notation: { symbols: [] } }
  const chips = new Map(chipsOf(level).map((c) => [c.key, c]))
  let tree = chips.get('c:ann').make()
  assert.deepEqual(straysOf(tree), [[]])
  const { joinsOnto } = sentenceLanguage({ words: { Parent: '{0} is a parent of {1}' } })
  const at = joinsOnto(tree, chips.get('P:Parent'), chips.get('P:Parent').make())
  tree = setAt(tree, at, setAt(chips.get('P:Parent').make(), [0], nodeAt(tree, at)))
  tree = setAt(tree, holesOf(tree)[0].path, chips.get('c:bo').make())
  assert.deepEqual(straysOf(tree), [])
  assert.ok(same(tree, parse('Parent(ann, bo)', { consts: ['ann', 'bo'] })))
})

test('only chips with leading holes join, using the written order of arguments', async () => {
  const { chipsFrom, setAt } = await import('../core/formulaTree.js')
  const { sentenceLanguage } = await import('../core/sentenceLanguage.js')
  const formulas = [bin('⟹', parse('A ∨ ¬B'), parse('R')), parse('Parent(s(ann), bo)', { consts: ['ann', 'bo'] })]
  const chips = new Map(chipsFrom(formulas).map((chip) => [chip.key, chip]))
  const place = (key) => chips.get(key).make()
  const { holesOf, joinsOnto } = sentenceLanguage({ words: { Parent: '{1} has parent {0}' } })
  const target = (tree, key) => joinsOnto(tree, chips.get(key), place(key))
  const a = place('P:A')
  const partial = setAt(place('∨'), [0], a)
  assert.equal(target(a, '⟹'), null)
  assert.equal(target(partial, '¬'), null)
  assert.deepEqual(target(partial, '∨'), [0])
  assert.equal(target(partial, 'P:B'), null)
  const ann = place('c:ann')
  assert.deepEqual(target(setAt(place('∨'), [0], ann), 'P:Parent'), [0])
  assert.deepEqual(holesOf(place('P:Parent')).map(({ path }) => path), [[1], [0]])
  const parent = setAt(place('P:Parent'), [0], ann)
  assert.equal(target(parent, 'f:s'), null)
  assert.equal(target(parent, 'P:Parent'), null)
})

// ¬∀x. P(x) ⟹ ∃x. ¬P(x), classically (q-dm's last task): suppose there is no x with ¬P(x); then every x has P(x).
const NOT_ALL = proof({
  k: ['impI', { A: '¬∃x. ¬P(x)' }], g: ['allI', {}, 'k'], j: ['impI', { A: '¬P(a)' }, 'g'], i: ['exI', { target: '∃x. ¬P(x)' }, 'j'], mj: ['mp', {}, 'j'], r1: ['raa', {}, 'g'], m2: ['mp', {}, 'k'], r2: ['raa'],
}, ['j#body>i.a', 'k#body>mj.imp', 'i>mj.a', 'mj>j.body', 'j>r1.nna', 'r1>g.body', 'p>m2.imp', 'g>m2.a', 'm2>k.body', 'k>r2.nna', 'r2>goal'], { premises: ['p'] })

test('a lemma over a quantified letter fits any variable and keeps it', async () => {
  const { lemma } = await import('../core/proof.js')
  const qdm = lemma({ statement: '∃x. ¬P', premises: ['¬∀x. P'], metas: ['P'] })
  const proofs = { qdm: { '': provenBy({ premises: { p: '¬∀x. P(x)' }, goal: '∃x. ¬P(x)' }, NOT_ALL) } }
  const got = qdm.eval({ p0: { formula: parse('¬∀y. D(y)'), hyps: new Map(), term: null } }, { type: 'qdm', params: {} }, { proofs, engine: { parts: proofParts() } })
  assert.ok(same(got.formula, parse('∃y. ¬D(y)')))
  assert.ok(lemmaGives({ statement: '∃x. ¬P', premises: ['¬∀x. P'], metas: ['P'] }, [parse('¬∀z. R(z, z)')], parse('∃z. ¬R(z, z)')))
})

test('Example reads off its example, and picks the one ∃ sentence that fits', async () => {
  const input = [{ formula: parse('Likes(a, a)'), hyps: new Map(), term: null }]
  const ctx = { consts: [], subst: {}, exists: [parse('∃x. Likes(x, x)')], node: { params: {} } }
  assert.ok(same(RULES.exI.run(input, {}, ctx).formula, parse('∃x. Likes(x, x)')))
  assert.ok(same(RULES.exI.run(input, {}, { ...ctx, node: { params: { target: '∃x. Likes(a, x)' } } }).formula, parse('∃x. Likes(a, x)')))
  assert.throws(() => RULES.exI.run(input, {}, { ...ctx, exists: [parse('∃x. Likes(x, x)'), parse('∃x. Likes(x, a)')] }))
})

test('a lemma of several shapes computes as the shape its card is switched to', async () => {
  const { lemma } = await import('../core/proof.js')
  const dm = lemma({ metas: ['A', 'B', 'P'], forms: [
    { key: 'notOr', statement: '¬A ∧ ¬B', premises: ['¬(A ∨ B)'] },
    { key: 'notAll', statement: '∃x. ¬P', premises: ['¬∀x. P'] },
  ] })
  const j = (f) => ({ p0: { formula: parse(f), hyps: new Map(), term: null } })
  // Each shape runs the proof of its own task.
  const notOr = proof({ na: ['impI', { A: 'A' }], i: ['orI', { other: 'B', side: 'right' }, 'na'], m: ['mp', {}, 'na'], nb: ['impI', { A: 'B' }], i2: ['orI', { other: 'A', side: 'left' }, 'nb'], m2: ['mp', {}, 'nb'], c: ['andI'] }, ['na#body>i.a', 'p>m.imp', 'i>m.a', 'm>na.body', 'nb#body>i2.a', 'p>m2.imp', 'i2>m2.a', 'm2>nb.body', 'na>c.a', 'nb>c.b', 'c>goal'], { premises: ['p'] })
  const proofs = { dm: { notOr: provenBy({ premises: { p: '¬(A ∨ B)' }, goal: '¬A ∧ ¬B' }, notOr), notAll: provenBy({ premises: { p: '¬∀x. P(x)' }, goal: '∃x. ¬P(x)' }, NOT_ALL) } }
  assert.deepEqual(dm.forms, ['notOr', 'notAll'])
  assert.ok(same(dm.eval(j('¬(Rain ∨ Wind)'), { type: 'dm', params: {} }, { proofs, engine: { parts: proofParts() } }).formula, parse('¬Rain ∧ ¬Wind')))
  assert.ok(same(dm.eval(j('¬∀y. D(y)'), { type: 'dm', params: { form: 'notAll' } }, { proofs, engine: { parts: proofParts() } }).formula, parse('∃y. ¬D(y)')))
  assert.ok(lemmaGives({ metas: ['P'], forms: [{ key: 'notAll', statement: '∃x. ¬P', premises: ['¬∀x. P'] }] }, [parse('¬∀y. D(y)')], parse('∃y. ¬D(y)'), ['notAll']))
  assert.equal(lemmaGives({ metas: ['P'], forms: [{ key: 'notAll', statement: '∃x. ¬P', premises: ['¬∀x. P'] }] }, [parse('¬∀y. D(y)')], parse('∃y. ¬D(y)'), []), false)
})

test('formula and function equality compare the binders each occurrence refers to', async () => {
  const { sameSide, solveEqs } = await import('../core/schematic.js')
  const compares = (left, right, expected) => {
    assert.equal(same(parse(left), parse(right)), expected)
    assert.equal(same(parse(right), parse(left)), expected)
  }
  compares('∀x. Human(y)', '∀y. Human(y)', false)
  compares('∀x. ∀y. Human(x)', '∀z. ∀z. Human(z)', false)
  compares('∀x. ∀x. Human(x)', '∀y. ∀z. Human(z)', true)
  compares('∀P. Q(x)', '∀Q. Q(x)', false)
  compares('∀P. ∀Q. P(x)', '∀A. ∀A. A(x)', false)
  compares('∀P. ∀P. P(x)', '∀Q. ∀R. R(x)', true)
  compares('∀R. ¬R', '∀S. S → ⊥', true)
  assert.ok(same(parse('∀x. Human(x)', { consts: ['x'] }), parse('∀y. Human(y)')))
  const swappedTerms = substMany(parse('Likes(x, y)'), [['x', tvar('y')], ['y', tvar('x')]])
  assert.equal(show(swappedTerms), 'Likes(y, x)')

  const lambda = (params, text) => ({ op: 'lam', params, body: parse(text) })
  const left = lambda(['x', 'y'], 'Likes(x, y)')
  const swapped = lambda(['y', 'x'], 'Likes(y, x)')
  assert.equal(sameSide(left, swapped), true)
  const free = lambda(['x'], 'Human(y)')
  const bound = lambda(['y'], 'Human(y)')
  assert.equal(sameSide(free, bound), false)
  assert.equal(sameSide(bound, free), false)
  assert.ok(solveEqs([{ s: free, t: bound, bound: [] }]).fail)
})

test('unification solves sentences with ?-letters, patterns as functions, and refuses what has no solution', async () => {
  const { FULL, parseEquation, sideText, solveEqs } = await import('../core/schematic.js')
  const solve = (text) => {
    const set = solveEqs([parseEquation(text)], { rules: FULL })
    return set.fail ? 'fail' : set.eqs.map((e) => `${sideText(e.s)} ≐ ${sideText(e.t)}`).join('; ')
  }
  assert.equal(solve('?A ∧ ?B ≐ Rain ∧ Wind'), '?A ≐ Rain; ?B ≐ Wind')
  assert.equal(solve('?A ∧ ?A ≐ Rain ∧ Wind'), 'fail')
  assert.equal(solve('?A ≐ ?A → Wet'), 'fail')
  assert.equal(solve('¬?A ≐ Rain → ⊥'), '?A ≐ Rain')
  assert.equal(solve('∀x. ?P(x) ≐ ∀y. Likes(y, ann)'), '?P ≐ fun x => Likes(x, ann)')
  // ?A may not take a bound variable out of its quantifier.
  assert.equal(solve('∀x. ?A ≐ ∀x. Human(x)'), 'fail')
})

test('rules used backwards leave ?-letters that a given settles later, and a fixed thing comes too late for an older one', async () => {
  const { parseS } = await import('../core/schematic.js')
  const { KERNEL, assumption, rule, startState } = await import('../core/tactics.js')
  const step = (s, ...r) => { const out = r[0](s, ...r.slice(1)); assert.ok(out.results, JSON.stringify(out.fail)); return out.results[0] }
  let s = startState(parseS('Wet'), ['Rain → Wet', 'Rain'].map(parseS))
  s = step(s, rule, KERNEL.mp)
  assert.equal(show(s.goals[1].goal), '?A')
  s = step(s, assumption)
  assert.equal(show(s.goals[0].goal), 'Rain')
  assert.equal(step(s, assumption).goals.length, 0)
  // Take one only fits forwards: backwards ?P(?t) is no pattern.
  const t = startState(parseS('Mortal(soc)'), ['∀x. Human(x) → Mortal(x)', 'Human(soc)'].map(parseS))
  assert.ok(rule(t, KERNEL.spec).fail)
  // Cut makes a premise to prove. After instantiation and assumption, the conclusion joins the givens.
  const have = step(t, rule, KERNEL.cut)
  const f = step(step(have, rule, KERNEL.spec), assumption)
  assert.equal(f.goals[0].hyps.length, 3)
  assert.equal(step(step(step(f, rule, KERNEL.mp), assumption), assumption).goals.length, 0)
  // An example left before the thing was taken out cannot become it.
  let u = startState(parseS('∃x. Rich(x)'), [parseS('∃x. Human(x) ∧ Rich(x)')])
  u = step(u, rule, KERNEL.exI)
  u = step(step(u, rule, KERNEL.exE), assumption)
  u = step(step(u, rule, KERNEL.conjE), assumption)
  assert.match(assumption(u).fail.en, /was left before/)
})

test('a search does not follow a step that gives nothing new, so using givens again comes to an end', async () => {
  const { parseS } = await import('../core/schematic.js')
  const { ELIM_RULES, INTRO_RULES } = await import('../core/schematic.js')
  const { KERNEL, assumption, depthFirst, rule, startState } = await import('../core/tactics.js')
  // The reference auto: each step Assumption, then every introduction rule, then every elimination rule and Assumption.
  const ok = (r) => r.results ?? []
  const elim = (x, r) => ok(rule(x, r)).flatMap((y) => ok(assumption(y)))
  const step = (x) => [...ok(assumption(x)), ...INTRO_RULES.flatMap((k) => ok(rule(x, KERNEL[k]))), ...ELIM_RULES.flatMap((k) => elim(x, KERNEL[k]))]
  const run = (goal) => depthFirst([startState(parseS(goal))], step, { limit: 250, most: 60 })
  assert.ok(run('(∃x. Human(x) ∧ Likes(x, ann)) → ∃x. Likes(x, ann)').found.length)
  // Not provable without proof by contradiction: the search runs out of new steps rather than of time.
  const lost = run('(¬Rain → Rain) → Rain')
  assert.equal(lost.found.length + Number(lost.stopped), 0)
})

test('a machine backtracks once its level says so, and a search finds every answer to a question', () => {
  const board = machine({
    a: ['logic/directBackward-exI'], b: ['logic/directBackward-andI'], c: [CITE], d: [CITE],
  }, ['in>a', 'a>b', 'b>c', 'c>d', 'd>out'])
  const test1 = { goal: '∃x. Human(x) ∧ Likes(x, ann)', hyps: ['Human(cy)', 'Human(bo)', 'Likes(bo, ann)'] }
  const level = onMachine({ kind: 'logic/machine', want: 'logic/proved', tests: [test1] })
  assert.equal(runMachine(level, board).pass, false)
  assert.equal(runMachine({ ...level, backtrack: true }, board).pass, true)
  const ask = onMachine({
    kind: 'logic/machine', want: 'logic/answers', backtrack: true,
    rules: { grand: { name: { zh: '祖父母', en: 'Grandparent' }, premises: ['Parent(?x, ?y)', 'Parent(?y, ?z)'], conclusion: 'Grand(?x, ?z)' } },
    tests: [{ goal: 'Grand(ann, ?w)', hyps: ['Parent(ann, bo)', 'Parent(bo, cy)', 'Parent(bo, dee)'], answers: ['cy', 'dee'] }],
  })
  const query = machine({ g: ['logic/directBackward-grand'], a: [CITE], b: [CITE] }, ['in>g', 'g>a', 'a>b', 'b>out'])
  assert.equal(runMachine(ask, query).pass, true)
})

test('ordinary wires retain each alternative for a later proof step', () => {
  const level = onMachine({ kind: 'logic/machine', want: 'logic/proved', tests: [{ goal: 'Rain ∨ Wind', hyps: ['Wind'] }] })
  const board = machine({
    left: ['logic/directBackward-orI', { use: ['disjI1'] }], right: ['logic/directBackward-orI', { use: ['disjI2'] }],
    join: ['append'], finish: [CITE],
  }, ['in>left', 'in>right', 'left>join.first', 'right>join.second', 'join>finish', 'finish>out'])
  const junction = board.nodes.find(({ id }) => id === 'join')
  assert.deepEqual(machineParts('append').inputs(junction), ['first', 'second'])
  assert.deepEqual(machineParts('append').inputs({ ...junction, params: { ways: '3' } }), ['first', 'second', 'third'])
  assert.equal(runMachine(level, board).pass, false)
  const traced = runMachine({ ...level, backtrack: true }, board, { traced: true })
  assert.equal(traced.pass, true)
  const { trace } = traced.runs[0]
  assert.deepEqual(trace.map(step => step.id), ['left', 'right', 'finish', 'finish'])
  assert.deepEqual([...traced.runs[0].nodeStatuses], [['right', 'applied'], ['finish', 'applied']])
  const merge = traced.runs[0].values.get('join')
  assert.equal(merge.more[0].goals.length, 1)
  const [left, right] = trace.filter(({ id }) => id === 'left' || id === 'right').map(({ proof }) => proof)
  assert.equal(left.resultPath, undefined)
  assert.equal(right.resultPath, true)
  const [skipped, solved] = trace.filter(({ id }) => id === 'finish')
  assert.equal(skipped.status, 'skipped')
  assert.equal(skipped.value.error, undefined)
  assert.equal(skipped.proof.parent, left.id)
  assert.equal(skipped.proof.resultPath, undefined)
  assert.equal(solved.status, 'applied')
  assert.equal(solved.proof.resultPath, true)
  assert.equal(solved.proof.closed.length, 1)
  assert.equal(solved.proof.parent, right.id)
  assert.equal(runMachine(level, board, { traced: true }).runs[0].proofRoot.resultPath, undefined)
})

test('a search report follows the successful path through separate rounds', () => {
  const level = onMachine({ kind: 'logic/machine', want: 'logic/proved', backtrack: true, tests: [{ goal: 'Rain ∨ Wind', hyps: ['Wind'] }] })
  const board = machine({
    search: ['search', { depth: 3 }],
    left: ['logic/directBackward-orI', { use: ['disjI1'] }, 'search'],
    right: ['logic/directBackward-orI', { use: ['disjI2'] }, 'search'],
    cite: [CITE, {}, 'search'],
    join: ['append', { ways: '3' }, 'search'],
  }, [
    'in>search', 'search#body>left', 'search#body>right', 'search#body>cite',
    'left>join.first', 'right>join.second', 'cite>join.third', 'join>search.body', 'search>out',
  ])
  const report = runMachine(level, board, { traced: true })
  assert.equal(report.pass, true)
  const { trace } = report.runs[0]
  assert.ok(trace.every(({ round }) => !round))
  const comparisons = trace.filter(step => step.id === 'search')
  assert.equal(comparisons.length, 3)
  assert.ok(comparisons.every(step => step.value.did.op === 'searchCheck'))
  assert.equal(comparisons.filter(step => step.proof.resultPath).length, 1)
  assert.ok(trace.some(({ value, proof }) => value.did?.op === 'assumption' && proof.resultPath))
  const seen = new Set([0])
  for (const { proof } of trace) {
    if (!proof) continue
    assert.ok(seen.has(proof.parent))
    assert.ok(!seen.has(proof.id))
    seen.add(proof.id)
  }
})

test('a single-proof report ends at the judged answer even when the search continues', () => {
  const goal = 'Human(?w)'
  const hyps = ['Human(ann)', 'Human(bo)']
  const level = onMachine({
    kind: 'logic/machine', want: 'logic/proved', backtrack: true,
    rules: { defer: { name: 'Defer', premises: ['Other(?x)'], conclusion: 'Human(?x)' } },
    tests: [
      { goal, hyps }, { goal, hyps, want: 'logic/answers', answers: ['ann', 'bo'] },
      { goal, hyps: [], want: 'logic/fails' },
    ],
  })
  const board = machine({
    search: ['search', { depth: 2 }], cite: [CITE, {}, 'search'],
    defer: ['logic/directBackward-defer', {}, 'search'], join: ['append', {}, 'search'],
  }, [
    'in>search', 'search#body>cite', 'search#body>defer',
    'cite>join.first', 'defer>join.second', 'join>search.body', 'search>out',
  ])

  const traced = runMachine(level, board, { traced: true })
  const plain = runMachine(level, board)
  assert.equal(traced.pass, true)
  assert.equal(plain.pass, true)
  assert.deepEqual(traced.runs.map(run => structuredClone(run.outputs)), plain.runs.map(run => structuredClone(run.outputs)))
  const [proved, answers, exhausted] = traced.runs
  assert.equal(proved.outputs.out.more.length, 1)
  const last = proved.trace.at(-1)
  assert.equal(last.id, 'cite')
  assert.deepEqual(last.value.goals, [])
  assert.deepEqual(last.value.inst, proved.outputs.out.inst)
  assert.equal(last.proof.resultPath, true)
  assert.ok(answers.trace.length > proved.trace.length)
  assert.equal(answers.trace.filter(step => step.proof.resultPath && !step.value.goals.length).length, 2)
  assert.equal(answers.trace.at(-1).proof.stopReasonKey, 'noProgress')
  assert.ok(exhausted.trace.some(step => step.proof.stopReasonKey === 'noProgress'))

  const packed = builtMachine('auto', () => level, level, () => board)
  const packedLevel = { ...level, parts: type => type === 'auto' ? packed : level.parts(type) }
  const packedBoard = machine({ packed: ['auto'] }, ['in>packed', 'packed>out'])
  const packedReport = runMachine(packedLevel, packedBoard, { traced: true })
  assert.equal(packedReport.pass, true)
  const packedLast = packedReport.runs[0].trace.at(-1)
  assert.deepEqual(packedLast.path, ['packed'])
  assert.deepEqual(packedLast.value.goals, [])
  assert.equal(packedLast.proof.resultPath, true)
})

test('search prunes a round with sentence metavariables in goals or hypotheses', () => {
  const level = onMachine({
    kind: 'logic/machine', want: 'logic/proved', backtrack: true,
    tests: [
      { goal: '?P(a) → (Rain → Rain)', want: 'logic/fails' },
      { goal: 'Human(?w) → (Rain → Rain)' },
      { goal: 'Rain → Human(?w)', hyps: ['Human(a)'], want: 'logic/answers', answers: ['a'] },
      { goal: 'Rain', hyps: ['Wind'], want: 'logic/fails' },
      { goal: 'Rain', hyps: ['Rain ∧ Wet', 'Wind'] },
    ],
  })
  const board = machine({
    search: ['search'],
    intro: ['logic/directBackward-impI', {}, 'search'],
    elim: ['logic/directBackward-andE', { use: ['conjE'] }, 'search'],
    cite: [CITE, {}, 'search'],
    join: ['append', { ways: '3' }, 'search'],
    finish: [CITE, {}, 'search'],
  }, [
    'in>search', 'search#body>intro', 'search#body>elim', 'elim>cite',
    'search#body>finish', 'intro>join.first', 'cite>join.second', 'finish>join.third',
    'join>search.body', 'search>out',
  ])

  const report = runMachine(level, board, { traced: true })
  assert.equal(report.pass, true)
  assert.equal(runMachine(level, board).pass, true)
  const pruned = run => run.trace.filter(step => step.proof.stopReasonKey === 'unresolved-sentence-meta')
  const [hypothesis, , , goal, settled] = report.runs
  assert.ok(pruned(hypothesis).some(step => step.value.goals.length === 1
    && show(step.value.goals[0].goal) === 'Rain → Rain' && step.value.goals[0].hyps[0].name === '?P'))
  assert.ok(pruned(goal).some(step => step.value.goals[0].goal.op === '∧'))
  assert.ok(goal.trace.some(step => step.id === 'cite' && step.status === 'skipped' && step.reason === 'rule-mismatch'))
  assert.equal(goal.outputs.out.endless, undefined)
  assert.ok(settled.trace.some(step => step.id === 'cite' && step.status === 'applied' && step.proof.resultPath))
})

test('search limits unpinned backward cards to the first goal and honors explicit later targets', () => {
  const level = onMachine({
    kind: 'logic/machine', want: 'logic/fails', backtrack: true,
    tests: [{ goal: 'Rain ∧ (Wind → Slip)' }],
  })
  const open = 'logic/directBackward-impI'
  const board = machine({
    split: ['logic/directBackward-andI'],
    search: ['search'],
    open: [open, {}, 'search'],
  }, ['in>split', 'split>search', 'search#body>open', 'open>search.body', 'search>out'])
  const node = board.nodes.find(node => node.id === 'open')
  const opening = task => runMachine(task, board, { traced: true }).runs[0].trace.find(step => step.id === 'open')
  const skipped = opening(level)
  assert.equal(skipped.status, 'skipped')
  assert.equal(skipped.reason, 'rule-mismatch')
  assert.deepEqual(skipped.value.goals.map(g => show(g.goal)), ['Rain', 'Wind → Slip'])
  assert.equal(opening({ ...level, backtrack: false }).status, 'skipped')

  node.params.at = 'goal-0'
  assert.equal(opening(level).reason, 'position-missing')
  const noMatch = { ...level, tests: [{ goal: 'Rain ∧ Wind' }] }
  assert.equal(opening(noMatch).reason, 'rule-mismatch')
  node.params.at = 'goal-3'
  assert.equal(opening(level).reason, 'position-missing')
  assert.equal(opening(noMatch).reason, 'rule-mismatch')

  node.params.at = 'goal-1'
  const selected = opening(level)
  assert.equal(selected.status, 'applied')
  assert.deepEqual(selected.value.goals.map(g => show(g.goal)), ['Rain', 'Slip'])
  assert.deepEqual(selected.value.goals[1].hyps.map(show), ['Wind'])

  const outside = machine({
    split: ['logic/directBackward-andI'], open: [open],
  }, ['in>split', 'split>open', 'open>out'])
  const straight = { ...level, want: 'logic/becomes', tests: [{ ...level.tests[0], becomes: [['Rain', 'Wind ⊢ Slip']] }] }
  assert.equal(runMachine(straight, outside).pass, true)
})

test('the hypothesis rule closes only a goal with a matching given and retains every match', () => {
  const board = machine({ use: [CITE] }, ['in>use', 'use>out'])
  const task = { kind: 'logic/machine', want: 'logic/answers', backtrack: true, tests: [
    { goal: 'Human(?w)', hyps: ['Human(ann)', 'Human(bo)'], answers: ['ann', 'bo'] },
  ] }
  const report = runMachine(onMachine(task), board, { traced: true })
  assert.equal(report.pass, true)
  assert.equal(report.runs[0].trace.find(({ id }) => id === 'use').value.did.op, 'assumption')
  assert.deepEqual(report.runs[0].trace.filter(step => step.id === 'use').map(step => step.proof.resultPath), [true, true])
  assert.equal(runMachine(onMachine({ ...task, want: 'logic/proved', tests: [{ goal: 'Rain' }] }), board).pass, false)
})

test('a machine uses the same evaluation for its playback and the final board', () => {
  const evaluated = []
  const task = onMachine({
    kind: 'logic/machine', want: 'logic/proved', tests: [{ goal: 'Rain', hyps: ['Rain'] }],
  })
  const parts = task.parts
  task.parts = type => {
    const part = parts(type)
    if (type !== CITE) return part
    return {
      ...part,
      eval(ins, node, ctx, key) {
        evaluated.push(node.id)
        return part.eval(ins, node, ctx, key)
      },
    }
  }
  const board = machine({ spare: [CITE], end: [CITE] }, ['in>spare', 'in>end', 'end>out'])
  const report = runMachine(task, board, { traced: true })
  assert.equal(report.pass, true)
  assert.deepEqual(evaluated, ['end', 'spare'])
  assert.equal(report.runs[0].values.get('spare').kind, 'state')
  assert.deepEqual(report.runs[0].trace.map(({ id }) => id), ['end'])
  assert.ok(report.runs[0].values.has('in'))
})

test('a proof machine must meet its card budget after its cases pass', () => {
  const task = { kind: 'logic/machine', want: 'logic/proved', tests: [{ goal: 'Rain', hyps: ['Rain'] }] }
  const board = machine({ a: [CITE] }, ['in>a', 'a>out'])
  assert.equal(runMachine(onMachine({ ...task, budget: 1 }), board).pass, true)
  const report = runMachine(onMachine({ ...task, budget: 0 }), board)
  assert.deepEqual(report.runs.map((run) => run.pass), [true])
  assert.equal(report.score.steps, 1)
  assert.equal(report.pass, false)
  assert.equal(report.fail.why, report.constraint)
})

test('a rewrite changes the first place its left side fits, under quantifiers too, and leaves its conditions as goals', async () => {
  const { rewrite, simplify, rewriteBookOf } = await import('../core/rewrite.js')
  const { startState } = await import('../core/tactics.js')
  const { parseS } = await import('../core/schematic.js')
  const lemmas = {
    dneg: { name: { zh: '', en: '' }, metas: ['A'], forms: [{ key: 'elim', label: '', statement: 'A', premises: ['¬¬A'] }, { key: 'intro', label: '', statement: '¬¬A', premises: ['A'] }] },
    dm: { name: { zh: '', en: '' }, metas: ['A', 'B', 'P'], forms: [
      { key: 'notOr', label: '', statement: '¬A ∧ ¬B', premises: ['¬(A ∨ B)'] }, { key: 'andNot', label: '', statement: '¬(A ∨ B)', premises: ['¬A ∧ ¬B'] },
      { key: 'notEx', label: '', statement: '∀x. ¬P', premises: ['¬∃x. P'] }, { key: 'allNot', label: '', statement: '¬∃x. P', premises: ['∀x. ¬P'] },
      { key: 'exNot', label: '', statement: '¬∀x. P', premises: ['∃x. ¬P'] },
    ] },
  }
  const book = rewriteBookOf({ lemmas, defs: ['plus(zero, y) = y', 'plus(s(x), y) = s(plus(x, y))', 'le(x, y) = tt ⟹ max(x, y) = y'] })
  // A shape whose converse is not a shape of its card is no rewrite rule.
  assert.equal(book['dm.exNot'], undefined)
  const goals = (r) => r.results[0].goals.map((g) => show(g.goal))
  const once = (goal, key, hyps = []) => rewrite(startState(parseS(goal), hyps.map(parseS)), book[key])
  assert.deepEqual(goals(once('¬¬¬¬Rain ∧ ¬¬Wind', 'dneg.elim')), ['¬¬Rain ∧ ¬¬Wind'])
  assert.deepEqual(goals(once('∀y. ¬∃x. Likes(y, x)', 'dm.notEx')), ['∀y. ∀x. ¬Likes(y, x)'])
  assert.deepEqual(goals(once('max(zero, s(zero)) = s(zero)', 'def.2')), ['s(zero) = s(zero)', 'le(zero, s(zero)) = tt'])
  assert.deepEqual(goals(once('s(plus(a, zero)) = s(a)', 'hyp', ['plus(a, zero) = a'])), ['s(a) = s(a)'])
  assert.ok(once('Rain ∧ Wind', 'dneg.elim').fail)
  const simp = simplify(startState(parseS('plus(s(s(zero)), s(zero)) = s(s(s(zero)))')), [book['def.0'], book['def.1']])
  assert.deepEqual(goals(simp), ['s(s(s(zero))) = s(s(s(zero)))'])
  assert.ok(simplify(startState(parseS('¬(Rain ∨ Wind)')), [book['dm.notOr'], book['dm.andNot']]).fail)
})

test('a single commutativity lemma serves as its own converse under schematic renaming', async () => {
  const { lemmaRewrites, rewrite } = await import('../core/rewrite.js')
  const { startState } = await import('../core/tactics.js')
  const name = { zh: '交换律', en: 'Commutativity' }
  const [rule] = lemmaRewrites('comm', { name, metas: ['A', 'B'], premises: ['A ∨ B'], statement: 'B ∨ A' })
  assert.equal(rule.key, 'comm')
  const state = startState(parse('(Rain ∨ Wind) → (Rain ∨ Wind)'))
  assert.equal(show(rewrite(state, rule, 'goal-1').results[0].goals[0].goal), 'Rain ∨ Wind → Wind ∨ Rain')
  assert.deepEqual(lemmaRewrites('projection', { name, metas: ['A', 'B'], premises: ['A ∧ B'], statement: 'A' }), [])
  assert.deepEqual(lemmaRewrites('duplicate', { name, metas: ['A', 'B'], premises: ['A ∨ B'], statement: 'B ∨ B' }), [])
})

test('rewrite previews and selections share locations, including overlapping terms and givens', async () => {
  const { rewrite, rewriteBookOf, rewriteOptions, rewritePreview, rewriteTarget } = await import('../core/rewrite.js')
  const { startState } = await import('../core/tactics.js')
  const { parseS } = await import('../core/schematic.js')
  const book = rewriteBookOf({ defs: ['f(x) = x'] })
  const rule = book['def.0']
  const state = startState(parseS('f(f(a)) = f(b)'), ['P(f(c))', 'Q(f(d), f(e))'].map(parseS))
  const options = rewriteOptions(state, [rule])
  assert.deepEqual(options.map(({ value, depth }) => [value, depth]), [
    ['goal-0', 0], ['goal-1', 1], ['goal-2', 0], ['hyp-0-0', 0], ['hyp-1-0', 0], ['hyp-1-1', 0],
  ])
  assert.equal(rewriteTarget(undefined, options), 'goal-0')
  const givenMatches = rewriteOptions(startState(parseS('R(a)'), ['P(f(c))', 'Q(f(d))'].map(parseS)), [rule])
  assert.equal(rewriteTarget(undefined, givenMatches), 'hyp-0-0')
  assert.equal(rewriteTarget('hyp-1-0', givenMatches), 'hyp-1-0')
  const selected = options.find(({ value }) => value === 'goal-1')
  assert.equal(render(selected.original, { symbols: [] }, 'en', -1, (node, text) => node === selected.node ? `[${text}]` : text), 'f([f(a)]) = f(b)')
  const preview = rewritePreview(selected)
  assert.equal(render(preview.original, { symbols: [] }, 'en', -1, (node, text) => node === preview.node ? `[${text}]` : text), 'f([a]) = f(b)')
  assert.equal(show(preview.original), show(rewrite(state, rule, 'goal-1').results[0].goals[0].goal))
  assert.equal(show(rewrite(state, rule, 'hyp-1-1').results[0].goals[0].hyps[1]), 'Q(f(d), e)')
  assert.equal(show(rewrite(state, rule, 'hyps').results[0].goals[0].hyps[0]), 'P(c)')
  assert.ok(rewrite(state, rule, 'goal-3').fail)
})

test('a rewrite card defaults to a unique match in a given and reports that target', () => {
  const task = onMachine({
    kind: 'logic/machine', want: 'logic/becomes', defs: ['f(x) = x'],
    tests: [{ goal: 'R(a)', hyps: ['P(a)', 'Q(f(a))'], becomes: [['P(a); Q(a) ⊢ R(a)']] }],
  })
  const board = machine({ change: ['logic/directRewrite-math'] }, ['in>change', 'change>out'])
  const report = runMachine(task, board)
  assert.equal(report.pass, true)
  assert.equal(report.runs[0].values.get('change').did.op, 'rwHyps')
  board.nodes.find(node => node.id === 'change').params.at = 'goal-0'
  assert.equal(runMachine(task, board).pass, false)
})

test('a machine case uses the same symbolic letters in its input and expected result', () => {
  const task = { notation: { symbols: ['↔', '∧'], words: { Rain: 'it rains', Wet: 'it is wet', Wind: 'it is windy' } } }
  const test = { hyps: ['Rain ↔ Wet'], goal: 'Rain ∧ Wind', becomes: [['Rain ↔ Wet ⊢ Wet ∧ Wind']] }
  const general = { ...task, notation: machineGeneralNotation(task, test) }
  const [input, output] = machineReadout.entries({ task: general, test })
  assert.equal(machineReadout.show(input.given, { task: general }), 'A ↔ B ⊢₁ A ∧ C')
  assert.equal(machineReadout.show(output.want, { task: general }), 'A ↔ B ⊢₁ B ∧ C')
  assert.equal(didText({ op: 'rule', rules: ['impI'] }, { ruleSlots: [{ entry: { key: 'impI' } }] }), '⊢₁ ⟵ R₁')
  assert.equal(test.goal, 'Rain ∧ Wind')
  assert.deepEqual(machineGeneralNotation(task, { goal: 'Rain ∧ A' }).words, { Rain: 'B' })
  assert.deepEqual(Object.keys(machineGeneralNotation(task, { clauses: ['Rain', '¬Rain ∨ Wind'] }).words).sort(), ['Rain', 'Wind'])
})

test('equivalent substitution replaces one selected occurrence and avoids capture', () => {
  const iff = proved(parse('A ↔ B'), new Map([['iff', parse('A ↔ B')]]))
  const p = proved(parse('A ∧ ¬A'), new Map([['p', parse('A ∧ ¬A')]]))
  const substitute = (iff, p, at, direction) => RULES.iffSubst.run([iff, p], {}, { node: { params: { at, direction } } })
  const choices = OPTIONS.iffOccurrences.run([iff, p])
  assert.deepEqual(choices.map(({ value }) => value), ['0', '1'])
  const marks = new Map(choices.map(({ node, value }) => [node, value]))
  const annotate = (node, text) => marks.has(node) ? `[${marks.get(node)}:${text}]` : text
  assert.equal(render(choices[0].original, { symbols: ['∧', '¬'] }, 'en', -1, annotate), '[0:A] ∧ ¬[1:A]')
  const result = substitute(iff, p, '1')
  assert.equal(show(result.formula), 'A ∧ ¬B')
  assert.deepEqual([...result.hyps.keys()], ['iff', 'p'])
  assert.equal(show(substitute(iff, proved(parse('A ∧ C'))).formula), 'B ∧ C')
  assert.throws(() => substitute(iff, p))
  assert.throws(() => substitute(iff, p, '2'))
  const reverse = proved(parse('B ∧ ¬B'))
  const reverseChoices = OPTIONS.iffOccurrences.run([iff, reverse], {}, { node: { params: { direction: 'reverse' } } })
  assert.deepEqual(reverseChoices.map(({ replacement }) => show(replacement)), ['A', 'A'])
  assert.equal(show(substitute(iff, reverse, '1', 'reverse').formula), 'B ∧ ¬A')
  const open = proved(parse('A ↔ P(x)'))
  const quantified = proved(parse('∀x. A'))
  assert.deepEqual(OPTIONS.iffOccurrences.run([open, quantified]), [])
  assert.throws(() => substitute(open, quantified, '0'))
})

test('the direct equivalence card ignores term equations and rewrites one goal occurrence', () => {
  const source = 'qed/iffSubst'
  const type = 'logic/directRewrite-qed_iffSubst'
  const level = {
    kind: 'logic/machine', directRuleCards: true, want: 'logic/becomes',
    ruleParts: { 'logic/iffSubst': source },
    partDefs: { [source]: { name: { en: 'Equivalent substitution', zh: '等价代换' } } },
    tests: [
      { goal: 'P(x)', hyps: ['x = y'], becomes: [['x = y ⊢ P(x)']] },
      { goal: 'P(x) ∧ P(x)', hyps: ['x = y', 'P(x) ↔ Q(x)'], becomes: [['x = y; P(x) ↔ Q(x) ⊢ Q(x) ∧ P(x)']] },
    ],
  }
  const card = directCardsOf(level).get(type)
  assert.deepEqual(card.entries.map(({ key }) => key), ['hyp.iff', 'hyp.iff.reverse'])
  assert.match(card.definition.name.en, /Equivalent substitution$/)
  const choices = RULE_CHOICES.run([], {}, { task: level, node: { type } })
  assert.equal(choices[0].label, '⟦A ↔ B; C[A]⟧ ⟹ C[B]')
  assert.equal(choices[1].label, '⟦A ↔ B; C[B]⟧ ⟹ C[A]')
  assert.deepEqual(choices[1].statements, [{ left: 'C[B]', right: 'C[A]', conditions: ['A ↔ B'] }])
  assert.equal(card.direction, 'rewrite')
  assert.equal(card.defaultRule, null)
  const generic = RULE_CHOICES.run([], {}, { task: level, node: { type: 'logic/directRewrite-logic_hyp' } })
  assert.match(generic[0].label, /C\[s\].*C\[t\].*C\[A\].*C\[B\]/)
  const compiled = compileParts({ [type]: card.definition }, OPS).PARTS
  level.parts = (name) => compiled[name] ?? machineParts(name)
  const board = machine({ change: [type, { use: ['hyp.iff'], at: 'goal-0' }] }, ['in>change', 'change>out'])
  assert.equal(runMachine(level, board).pass, true)
  const change = board.nodes.find(({ id }) => id === 'change')
  change.params.at = 'hyp-2-1'
  const given = runMachine({ ...level, tests: [{ goal: 'P(x)', hyps: ['x = y', 'P(x) ↔ Q(x)', 'P(x) ∧ P(x)'],
    becomes: [['x = y; P(x) ↔ Q(x); P(x) ∧ Q(x) ⊢ P(x)']] }] }, board, { traced: true })
  assert.equal(given.pass, true)
  assert.deepEqual(given.runs[0].trace[0].diff.changed[0].locations, [{ hyp: 2, path: ['b'] }])
  change.params.at = 'goal-1'
  level.tests[1].becomes = [['x = y; P(x) ↔ Q(x) ⊢ P(x) ∧ Q(x)']]
  assert.equal(runMachine(level, board).pass, true)
  change.params = { use: ['hyp.iff.reverse'], at: 'goal-0' }
  level.tests[1].goal = 'Q(x) ∧ Q(x)'
  assert.equal(runMachine(level, board).pass, true)
})

test('a direct rewrite uses only the first rule in an older multi-rule selection', () => {
  const level = {
    kind: 'logic/machine', directRuleCards: true, want: 'logic/becomes',
    lemmas: { dneg: { name: { zh: '双重否定律', en: 'Double negation' }, metas: ['A'], forms: [
      { key: 'elim', label: '', statement: 'A', premises: ['¬¬A'] },
      { key: 'intro', label: '', statement: '¬¬A', premises: ['A'] },
    ] } },
    tests: [{ goal: 'Rain', becomes: [['¬¬Rain']] }],
  }
  const cards = directCardsOf(level)
  const type = 'logic/directRewrite-dneg'
  const compiled = compileParts({ [type]: cards.get(type).definition }, OPS).PARTS
  level.parts = (name) => compiled[name] ?? machineParts(name)
  const board = machine({ change: [type, { use: ['dneg.elim', 'dneg.intro'] }] }, ['in>change', 'change>out'])
  const change = board.nodes.find(({ id }) => id === 'change')
  board.nodes.push({ ...change, id: 'other', params: { use: ['dneg.intro'] } })
  let order = ['change', 'other']
  const slots = () => boardRules(level, board, order)
  const keys = () => slots().map(({ entry }) => entry.key)
  const markOptions = (id) => RULE_CHOICES.run([], {}, {
    task: level, node: { id, type }, ruleSlots: slots(),
  }).map(({ value, mark }) => [value, mark])
  assert.deepEqual(markOptions('change'), [['dneg.elim', 'R₁'], ['dneg.intro', 'R₂']])
  assert.deepEqual(keys(), ['dneg.elim', 'dneg.intro'])
  order = ['other', 'change']
  assert.deepEqual(keys(), ['dneg.intro', 'dneg.elim'])
  assert.deepEqual(markOptions('other'), [['dneg.elim', 'R₂'], ['dneg.intro', 'R₁']])
  assert.equal(runMachine(level, board).pass, false)
  change.params.use = ['dneg.intro']
  assert.deepEqual(keys(), ['dneg.intro'])
  assert.deepEqual(markOptions('change'), [['dneg.elim', ''], ['dneg.intro', 'R₁']])
  assert.equal(runMachine(level, board).pass, true)
  change.params.use = []
  assert.deepEqual(keys(), ['dneg.intro'])
  assert.deepEqual(markOptions('change'), [['dneg.elim', ''], ['dneg.intro', 'R₁']])
})

test('bound rewrite configuration follows the available occurrences in each case', () => {
  const type = 'logic/directRewrite-qed_iffSubst'
  const level = {
    kind: 'logic/machine', directRuleCards: true, want: 'logic/becomes',
    ruleParts: { 'logic/iffSubst': 'qed/iffSubst' },
    partDefs: { 'qed/iffSubst': { name: 'Equivalent substitution' } },
    tests: [
      { goal: 'Rain ∧ Rain', hyps: ['Rain ↔ Wet'], becomes: [] },
      { goal: 'Rain', hyps: ['Rain ↔ Wet'], becomes: [['Rain ↔ Wet ⊢ Wet']] },
      { goal: 'Wind', hyps: ['Rain ↔ Wet'], becomes: [['Rain ↔ Wet ⊢ Wind']] },
      { goal: 'Wind', hyps: ['Rain ↔ Wet', 'Rain'], becomes: [['Rain ↔ Wet; Wet ⊢ Wind']] },
    ],
  }
  const card = directCardsOf(level).get(type)
  const { PARTS } = compileParts({ [type]: card.definition }, OPS)
  level.parts = name => PARTS[name] ?? machineParts(name)
  const unconfigured = machine({ change: [type, { use: [], at: 'goal-1' }], next: [type] },
    ['in>change', 'change>next', 'next>out'])
  const unconfiguredNode = unconfigured.nodes.find(({ id }) => id === 'change')
  const missing = runMachine(level, unconfigured, { traced: true })
  assert.deepEqual([...missing.runs[0].nodeStatuses], [['change', 'error']])
  assert.equal(missing.runs[0].trace[0].reason, 'rule-required')
  assert.equal(missing.runs[0].pass, false)
  assert.deepEqual(machineConfigurationCases(level, unconfiguredNode, [[]]), [{ pending: true, reason: 'rule-required' }])

  const board = machine({ change: [type, { use: ['hyp.iff'] }] }, ['in>change', 'change>out'])
  const node = board.nodes.find(({ id }) => id === 'change')
  const report = runMachine(level, board, { traced: true })
  const cases = report.runs.map(run => [run.values.get('in')])
  assert.deepEqual(machineConfigurationCases(level, node, cases), [
    { pending: true, reason: 'position-required' },
    { pending: false, reason: null },
    { pending: false, reason: null },
    { pending: false, reason: null },
  ])
  assert.deepEqual(cases.map(inputs => REWRITE_CHOICES.run(inputs, {}, { task: level, node })[0].defaultAt),
    [null, 'goal-0', null, 'hyp-1-0'])
  assert.deepEqual(report.runs.map(run => run.pass), [false, true, true, true])
  assert.deepEqual(report.runs.map(run => [run.trace[0].status, run.trace[0].reason]), [
    ['error', 'position-required'], ['applied', undefined], ['skipped', 'rule-mismatch'], ['applied', undefined],
  ])
  assert.equal(report.runs[0].outputs.out.configurationError, 'position-required')
  assert.deepEqual(report.runs[0].outputs.out.goals, cases[0][0].goals)

  node.params.at = 'goal-1'
  assert.deepEqual(machineConfigurationCases(level, node, [cases[0]]), [{ pending: false, reason: null }])
  const repeat = machine({ loop: ['repeat'], change: [type, { use: ['hyp.iff'] }] },
    ['in>loop.in', 'loop#body>change.in', 'change>loop.body', 'loop>out'])
  const frame = runMachine(level, repeat, { traced: true }).runs[0]
  assert.equal(frame.outputs.out.configurationError, 'position-required')
  assert.equal(frame.nodeStatuses.get('change'), 'error')
})

test('optional first-choice defaults agree across rewrite runs, previews and position pickers', () => {
  const source = 'example/substitute'
  const type = 'logic/directRewrite-example_substitute'
  const level = {
    kind: 'logic/machine', directRuleCards: true, want: 'logic/becomes',
    ruleParts: { 'logic/iffSubst': source }, partDefs: { [source]: { name: 'Substitution' } },
    tests: [{ goal: 'Rain ∧ Rain', hyps: ['Rain ↔ Wet'], becomes: [['Rain ↔ Wet ⊢ Wet ∧ Rain']] }],
  }
  const card = directCardsOf(level).get(type)
  const { PARTS } = compileParts({ [type]: card.definition }, OPS)
  level.parts = name => PARTS[name] ?? machineParts(name)
  const board = machine({ change: [type], preview: [type] }, ['in>change', 'change>out', 'in>preview'])
  const node = board.nodes.find(({ id }) => id === 'change')
  const enabled = { autoFirst: true }
  const strict = runMachine(level, board, { autoFirst: false, traced: true }).runs[0]
  const automatic = runMachine(level, board, { ...enabled, traced: true }).runs[0]
  const inputs = [automatic.values.get('in')]
  assert.equal(strict.trace[0].reason, 'rule-required')
  assert.equal(runMachine(level, board).pass, false)
  assert.equal(defaultBoundRule(card), null)
  assert.equal(defaultBoundRule(card, enabled), 'hyp.iff')
  assert.equal(automatic.pass, true)
  assert.equal(automatic.trace[0].status, 'applied')
  assert.equal(automatic.ruleSlots[0].entry.key, 'hyp.iff')
  assert.deepEqual(automatic.values.get('preview').goals, automatic.outputs.out.goals)
  assert.equal(strict.values.get('preview').configurationError, 'rule-required')
  assert.deepEqual(machineConfigurationCases(level, node, [[], inputs], enabled), [
    { pending: false, reason: null }, { pending: false, reason: null },
  ])
  assert.equal(REWRITE_CHOICES.run(inputs, {}, { task: level, node, ...enabled })[0].defaultAt, 'goal-0')
  assert.deepEqual(machinePositionCases(level, node, [inputs], enabled).map(({ value, cases }) => [value, cases[0].isDefault]),
    [['goal-0', true], ['goal-1', false]])

  node.params.use = ['hyp.iff']
  assert.equal(runMachine(level, board).runs[0].outputs.out.configurationError, 'position-required')
  assert.equal(runMachine(level, board, enabled).pass, true)
  node.params.at = 'goal-1'
  assert.equal(show(runMachine(level, board, enabled).runs[0].outputs.out.goals[0].goal), 'Rain ∧ Wet')
  node.params.use = ['hyp.iff.reverse']
  assert.equal(runMachine(level, board, { ...enabled, traced: true }).runs[0].trace[0].reason, 'rule-mismatch')

  const filtered = { ...level, withheldRuleChoices: new Set([`${source}.use=hyp.iff`]),
    tests: [{ goal: 'Wet ∧ Wet', hyps: ['Rain ↔ Wet'], becomes: [['Rain ↔ Wet ⊢ Rain ∧ Wet']] }] }
  assert.equal(defaultBoundRule(directCardsOf(filtered).get(type), enabled), 'hyp.iff.reverse')
  node.params = {}
  assert.equal(runMachine(filtered, board, enabled).pass, true)
})

test('identical rule formulas share a number across different rule keys', () => {
  const level = { directRuleCards: true, rules: {
    first: { name: 'First', premises: ['?A'], conclusion: '?B' },
    duplicate: { name: 'Duplicate', premises: ['?A'], conclusion: '?B' },
    reverse: { name: 'Reverse', premises: ['?B'], conclusion: '?A' },
  } }
  const board = machine({
    first: ['logic/directBackward-first'],
    duplicate: ['logic/directBackward-duplicate'],
    reverse: ['logic/directBackward-reverse'],
  }, [])
  const ruleSlots = boardRules(level, board, ['duplicate', 'reverse', 'first'])
  assert.deepEqual(ruleSlots.map(({ entry }) => entry.key), ['duplicate', 'reverse'])
  assert.equal(didText({ op: 'rule', rules: ['first', 'duplicate'] }, { ruleSlots }), '⊢₁ ⟵ R₁')
})

test('direct cards follow each source part and its declared proof operation', () => {
  const task = {
    directRuleCards: true,
    holds: ['firstBox', 'secondBox'],
    partDefs: {
      firstBox: { name: { zh: '甲框', en: 'First box' }, family: 'logic/box', icon: 'Box', desc: { en: 'A proof box' } },
      secondBox: { name: { zh: '乙框', en: 'Second box' } },
    },
    proofOperations: { firstBox: ['logic/impI', 'logic/impI'], secondBox: ['logic/impI'] },
  }
  const cards = directCardsOf(task)
  for (const source of ['firstBox', 'secondBox']) {
    const card = cards.get(`logic/directBackward-${source}`)
    assert.equal(card.source, source)
    assert.equal(card.direction, 'backward')
    assert.equal(card.defaultRule, 'impI')
    assert.equal(card.definition.desc, undefined)
    assert.deepEqual(card.entries.map((entry) => entry.key), ['impI'])
    assert.deepEqual(card.entries[0].statements, [{ conclusion: 'A → B', premises: ['⟦A⟧ ⟹ B'], fixes: [] }])
  }
  assert.ok(!cards.has('logic/directBackward-mp'))
  const type = 'logic/directBackward-firstBox'
  const { definition } = cards.get(type)
  assert.equal(definition.family, 'logic/box')
  assert.equal(definition.icon, 'Box')
  const compiled = compileParts({ [type]: definition }, OPS).PARTS
  const board = machine({ step: [type] }, ['in>step', 'step>out'])
  const level = {
    ...task, kind: 'logic/machine', want: 'logic/becomes',
    tests: [{ goal: 'Rain → Rain', becomes: [['Rain ⊢ Rain']] }],
    parts: (name) => compiled[name] ?? machineParts(name),
  }
  assert.equal(runMachine(level, board).pass, true)
})

test('a direct rule card reports when a completed or unmatched proof passes through', () => {
  const level = { kind: 'logic/machine', want: 'logic/proved', directRuleCards: true, tests: [{ goal: 'Rain → Rain' }] }
  const box = 'logic/directBackward-impI'
  const given = 'logic/directBackward-logic_assumption'
  const cards = directCardsOf(level)
  const { PARTS } = compileParts({ [box]: cards.get(box).definition, [given]: cards.get(given).definition }, OPS)
  level.parts = name => PARTS[name] ?? machineParts(name)
  const board = machine({ open: [box], finish: [given], extra: [box] }, ['in>open', 'open>finish', 'finish>extra', 'extra>out'])
  const solved = runMachine(level, board, { traced: true })
  assert.equal(solved.pass, true)
  const { trace } = solved.runs[0]
  assert.deepEqual(trace.map(({ id, status }) => [id, status]), [
    ['open', 'applied'], ['finish', 'applied'], ['extra', 'skipped'],
  ])
  assert.equal(trace.at(-1).proof.resultPath, true)
  assert.equal(trace.at(-1).reason, 'proved')
  assert.deepEqual([...solved.runs[0].nodeStatuses], [['open', 'applied'], ['finish', 'applied'], ['extra', 'skipped']])
  assert.deepEqual(trace[0].diff, {
    changed: [{ beforeGoalIndex: 0, goalIndex: 0, locations: [{ path: [] }, { hyp: 0, path: [] }] }],
    added: [], closed: [],
  })
  assert.deepEqual(trace[1].diff.closed, [0])
  assert.equal(trace[1].stateInfo.defaultGoalIndex, null)
  const forwarded = solved.runs[0].values.get('extra')
  assert.deepEqual(forwarded.goals, [])
  assert.equal(forwarded.error, undefined)
  const unmatched = runMachine({ ...level, tests: [{ goal: 'Rain → Wind' }] }, board, { traced: true })
  assert.equal(unmatched.pass, false)
  assert.deepEqual(unmatched.runs[0].trace.map(step => step.status), ['applied', 'skipped', 'skipped'])
  assert.equal(unmatched.runs[0].outputs.out.error, undefined)
  assert.deepEqual(unmatched.runs[0].trace.slice(1).map(step => step.reason), ['rule-mismatch', 'rule-mismatch'])
  assert.equal(unmatched.runs[0].nodeStatuses.get('extra'), 'skipped')
  const config = board.nodes.find(node => node.id === 'open')
  config.params = { use: ['unknown'] }
  const invalid = runMachine(level, board, { traced: true }).runs[0]
  assert.deepEqual([...invalid.nodeStatuses], [['open', 'error']])
  assert.equal(invalid.trace[0].status, 'error')
  assert.equal(invalid.trace[0].reason, undefined)
})

test('rewrite and citation cards pass unchanged goals to later attempts', () => {
  const source = 'qed/iffSubst'
  const rewrite = 'logic/directRewrite-qed_iffSubst'
  const cite = 'logic/directBackward-logic_assumption'
  const level = {
    kind: 'logic/machine', want: 'logic/proved', directRuleCards: true,
    ruleParts: { 'logic/iffSubst': source },
    partDefs: { [source]: { name: { en: 'Equivalent substitution', zh: '等价代换' } } },
    tests: [
      { goal: 'Rain ∧ Rain', hyps: ['Wet ↔ Rain', 'Wet ∧ Rain'] },
      { goal: 'Rain ∧ Rain', hyps: ['Rain ↔ Wet', 'Rain ∧ Wet'] },
    ],
  }
  const cards = directCardsOf(level)
  const { PARTS } = compileParts(Object.fromEntries([rewrite, cite].map(type => [type, cards.get(type).definition])), OPS)
  level.parts = name => PARTS[name] ?? machineParts(name)
  const board = machine({
    first: [rewrite, { use: ['hyp.iff.reverse'], at: 'goal-0' }],
    second: [rewrite, { use: ['hyp.iff'], at: 'goal-1' }], finish: [cite],
  }, ['in>first', 'first>second', 'second>finish', 'finish>out'])
  const result = runMachine(level, board, { traced: true })
  assert.equal(result.pass, true)
  assert.deepEqual(result.runs.map(run => run.trace.map(step => step.status)), [
    ['applied', 'skipped', 'applied'], ['skipped', 'applied', 'applied'],
  ])
  assert.equal(result.runs[0].trace[1].reason, 'position-missing')
  assert.deepEqual(result.runs[1].trace[1].diff.changed[0].locations, [{ path: ['b'] }])
  const selected = board.nodes.find(node => node.id === 'second')
  const positions = machinePositionCases(level, selected, result.runs.map(run => [run.values.get('first')]))
  const summary = value => positions.find(position => position.value === value).cases.map(({ exists, isDefault }) => [exists, isDefault])
  assert.deepEqual(summary('goal-0'), [[true, false], [true, false]])
  assert.deepEqual(summary('goal-1'), [[false, false], [true, false]])
})

test('pinned rewrites in repeat and search distinguish exhaustion from a match elsewhere', () => {
  const source = 'example/substitute'
  const type = 'logic/directRewrite-example_substitute'
  const level = onMachine({
    kind: 'logic/machine', want: 'logic/becomes', backtrack: true,
    ruleParts: { 'logic/iffSubst': source }, partDefs: { [source]: { name: 'Substitution' } },
    tests: [
      { goal: 'Rain', hyps: ['Rain ↔ Wet'], becomes: [['Rain ↔ Wet ⊢ Wet']] },
      { goal: 'Wind', hyps: ['Rain ↔ Wet', 'Rain'], becomes: [['Rain ↔ Wet; Rain ⊢ Wind']] },
      { goal: 'Wind', hyps: ['Rain ↔ Wet'], becomes: [['Rain ↔ Wet ⊢ Wind']] },
    ],
  })
  const card = [type, { use: ['hyp.iff'], at: 'goal-0' }, 'frame']
  for (const frame of ['repeat', 'search']) {
    const board = machine({ frame: [frame], change: card },
      ['in>frame', 'frame#body>change', 'change>frame.body', 'frame>out'])
    const report = runMachine(frame === 'search' ? { ...level, want: 'logic/fails' } : level, board, { traced: true })
    assert.equal(report.pass, true)
    assert.deepEqual(report.runs.map(run => run.trace.filter(step => step.id === 'change').map(step => step.reason)),
      [[undefined, 'rule-mismatch'], ['position-missing'], ['rule-mismatch']])
  }
})

test('bound apply, elimination, cut and proved lemmas leave metavariables that citation solves', () => {
  const types = ['mp', 'andE', 'logic_assumption', 'chain'].map(source => `logic/directBackward-${source}`)
  const [apply, eliminate, cite, chain] = types
  const level = { kind: 'logic/machine', directRuleCards: true, want: 'logic/proved', lemmas: {
    chain: { name: { en: 'Chain', zh: '串联' }, metas: ['A', 'B', 'C'], statement: 'A → C', premises: ['A → B', 'B → C'] },
  } }
  const cards = directCardsOf(level)
  const { PARTS } = compileParts(Object.fromEntries(types.map(type => [type, cards.get(type).definition])), OPS)
  level.parts = name => PARTS[name] ?? machineParts(name)
  const cases = [
    { type: apply, params: { use: ['mp'] }, input: { goal: 'Wet', hyps: ['Rain → Wet', 'Rain'] }, goals: ['?A → Wet', '?A'], inst: 'Rain' },
    { type: eliminate, params: { use: ['conjunct1'] }, input: { goal: 'Rain', hyps: ['Rain ∧ Wet'] }, goals: ['Rain ∧ ?B'], inst: 'Wet', meta: '?B' },
    { type: apply, params: { use: ['cut'] }, input: { goal: 'Wet', hyps: ['Rain', 'Wet'] }, goals: ['?A', 'Wet'], inst: 'Rain' },
    { type: chain, params: {}, input: { goal: 'Rain → Slip', hyps: ['Rain → Wet', 'Wet → Slip'] },
      goals: ['Rain → ?B', '?B → Slip'], inst: 'Wet', meta: '?B' },
  ]
  for (const { type, params, input, goals, inst, meta = '?A' } of cases) {
    level.tests = [input]
    const board = machine({ step: [type, params], first: [cite], second: [cite] },
      ['in>step', 'step>first', 'first>second', 'second>out'])
    const result = runMachine(level, board, { traced: true })
    assert.equal(result.pass, true)
    assert.deepEqual(result.runs[0].trace[0].value.goals.map(goal => show(goal.goal)), goals)
    assert.equal(show(result.runs[0].outputs.out.inst[meta]), inst)
    if (params.use?.[0] === 'mp') {
      const [split, first] = result.runs[0].trace
      assert.deepEqual(split.stateInfo.unknowns, ['?A'])
      assert.deepEqual(split.stateInfo.contexts.map(({ goalIndices }) => goalIndices), [[0, 1]])
      assert.equal(split.stateInfo.defaultGoalIndex, 0)
      assert.deepEqual(split.diff.added, [1])
      assert.deepEqual(first.diff, {
        changed: [{ beforeGoalIndex: 1, goalIndex: 0, locations: [{ path: [] }] }],
        added: [], closed: [0],
      })
      assert.deepEqual(first.stateInfo.unknowns, [])
    }
  }
})

test('given equations and equivalences only generate direct rewrite cards', () => {
  const name = { en: 'Substitution', zh: '代换' }
  const level = {
    kind: 'logic/machine', directRuleCards: true, want: 'logic/becomes',
    partDefs: { equality: { name }, equivalence: { name } },
    proofOperations: { equality: ['logic/rewrite'], equivalence: ['logic/iffSubst'] },
  }
  const cards = directCardsOf(level)
  for (const source of ['equality', 'equivalence']) {
    assert.deepEqual([...cards.values()].filter(card => card.source === source).map(card => card.direction), ['rewrite'])
  }
  const { PARTS } = compileParts(Object.fromEntries([...cards].map(([type, card]) => [type, card.definition])), OPS)
  level.parts = name => PARTS[name] ?? machineParts(name)
  for (const [type, key, goal, hyps, becomes] of [
    ['directRewrite-equality', 'hyp.eq', 'P(x)', ['x = y'], 'x = y ⊢ P(y)'],
    ['directRewrite-equivalence', 'hyp.iff', 'Rain', ['Rain ↔ Wet'], 'Rain ↔ Wet ⊢ Wet'],
    ['directRewrite-equality', 'hyp.eq', '∀x. P(x)', ['x = y'], 'x = y ⊢ ∀x. P(x)'],
  ]) {
    level.tests = [{ goal, hyps, becomes: [[becomes]] }]
    const result = runMachine(level, machine({ step: [`logic/${type}`, { use: [key] }] }, ['in>step', 'step>out']), { traced: true })
    assert.equal(result.pass, true, type)
    assert.equal(result.runs[0].trace[0].status, goal.startsWith('∀') ? 'skipped' : 'applied')
  }
})

test('a proved equivalence is rewritten only when its form is available', () => {
  const lemma = { name: { en: 'Law', zh: '定理' }, metas: ['A'], forms: [
    { key: 'law', label: '', statement: '¬¬A ↔ A', premises: [] },
  ] }
  const type = 'logic/directRewrite-law'
  const level = {
    kind: 'logic/machine', want: 'logic/becomes', directRuleCards: true, lemmas: { law: lemma },
    holds: ['law', 'andI'], forms: { law: ['law'] },
    tests: [{ goal: 'Rain ∧ ¬¬Wet', becomes: [['Rain', 'Wet']] }],
  }
  assert.ok(!directCardsOf({ ...level, forms: { law: [] } }).has(type))
  const cards = directCardsOf(level)
  const { PARTS } = compileParts(Object.fromEntries([...cards].map(([key, card]) => [key, card.definition])), OPS)
  level.parts = key => PARTS[key] ?? machineParts(key)
  const board = machine({ split: ['logic/directBackward-andI'], change: [type, { use: ['law.law.forward'] }] }, ['in>split', 'split>change', 'change>out'])
  const result = runMachine(level, board)
  assert.equal(result.pass, true)
  const node = board.nodes.find(node => node.id === 'change')
  node.params.at = 'g1:goal-0'
  assert.equal(runMachine(level, board).pass, true)
  node.params.at = 'goal-0'
  assert.equal(runMachine(level, board).pass, false)
})

test('backward rules preview and apply to a selected goal without moving the other goals', () => {
  const level = { kind: 'logic/machine', want: 'logic/becomes', directRuleCards: true, tests: [
    { goal: '(Rain → Wet) ∧ (Wind → Slip)', becomes: [['Rain → Wet', 'Wind ⊢ Slip']] },
    { goal: 'Rain ∧ (Wind → Slip)', becomes: [['Rain', 'Wind ⊢ Slip']] },
  ] }
  const split = 'logic/directBackward-andI'
  const open = 'logic/directBackward-impI'
  const cards = directCardsOf(level)
  const { PARTS } = compileParts(Object.fromEntries([split, open].map(type => [type, cards.get(type).definition])), OPS)
  level.parts = name => PARTS[name] ?? machineParts(name)
  const board = machine({ split: [split], open: [open, { at: 'goal-1' }] }, ['in>split', 'split>open', 'open>out'])
  const report = runMachine(level, board, { traced: true })
  assert.equal(report.pass, true)
  const node = board.nodes.find(node => node.id === 'open')
  for (const run of report.runs) {
    const options = BACKWARD_POSITIONS.run([run.values.get('split')], {}, { task: level, node })
    const output = run.values.get('open')
    assert.deepEqual(options[0].sequents, run.values.get('split').goals)
    assert.deepEqual(options.find(({ value }) => value === 'goal-1').result, output.goals)
    assert.equal(output.did.goalIndex, 1)
  }
  const positions = machinePositionCases(level, node, report.runs.map(run => [run.values.get('split')]))
  assert.deepEqual(positions.map(({ value, cases }) => [value, cases.map(({ exists, isDefault }) => [exists, isDefault])]), [
    ['goal-0', [[true, true], [false, false]]], ['goal-1', [[true, false], [true, true]]],
  ])
  delete node.params.at
  const automatic = runMachine(level, board)
  assert.deepEqual(automatic.runs.map(run => run.pass), [false, true])
  const autoFirst = { autoFirst: true }
  assert.deepEqual(runMachine(level, board, autoFirst).runs.map(run => run.outputs.out), automatic.runs.map(run => run.outputs.out))
  assert.deepEqual(machinePositionCases(level, node, report.runs.map(run => [run.values.get('split')]), autoFirst), positions)
  node.params.at = 'goal-3'
  for (const run of runMachine(level, board).runs) {
    assert.equal(run.outputs.out.error, undefined)
    assert.deepEqual(run.outputs.out.goals, run.values.get('split').goals)
  }
  node.params.at = 'hyp-0-0'
  for (const run of runMachine(level, board).runs) {
    assert.equal(run.outputs.out.error, undefined)
    assert.deepEqual(run.outputs.out.goals, run.values.get('split').goals)
  }
})

test('a backward card uses the first bound rule only with autoFirst when no rule is selected', () => {
  const type = 'logic/directBackward-orI'
  const level = {
    kind: 'logic/machine', want: 'logic/becomes', directRuleCards: true,
    tests: [{ goal: 'Rain ∨ Wet', becomes: [['Rain']] }],
  }
  const { PARTS } = compileParts({ [type]: directCardsOf(level).get(type).definition }, OPS)
  level.parts = name => PARTS[name] ?? machineParts(name)
  const board = machine({ step: [type] }, ['in>step', 'step>out'])
  const node = board.nodes.find(({ id }) => id === 'step')
  const autoFirst = { autoFirst: true }
  const automatic = runMachine(level, board, autoFirst).runs[0]
  const inputs = [automatic.values.get('in')]
  assert.equal(runMachine(level, board).runs[0].outputs.out.configurationError, 'rule-required')
  assert.equal(automatic.pass, true)
  assert.equal(BACKWARD_POSITIONS.run(inputs, {}, { task: level, node })[0].defaultAt, null)
  const [header, choice] = BACKWARD_POSITIONS.run(inputs, {}, { task: level, node, ...autoFirst })
  assert.equal(header.defaultAt, 'goal-0')
  assert.deepEqual(choice.result, automatic.outputs.out.goals)
  assert.deepEqual(choice.hyps, [])
  node.params.use = ['disjI2']
  assert.equal(show(runMachine(level, board, autoFirst).runs[0].outputs.out.goals[0].goal), 'Wet')
})

test('a copy card reports the given it reads as the place it closes', () => {
  const type = 'logic/directBackward-logic_assumption'
  const level = { kind: 'logic/machine', want: 'logic/proved', directRuleCards: true, holds: ['logic/assumption'],
    tests: [{ goal: 'Wet', hyps: ['Rain', 'Wet'] }] }
  const { PARTS } = compileParts({ [type]: directCardsOf(level).get(type).definition }, OPS)
  level.parts = name => PARTS[name] ?? machineParts(name)
  const board = machine({ step: [type] }, ['in>step', 'step>out'])
  const node = board.nodes.find(({ id }) => id === 'step')
  const run = runMachine(level, board).runs[0]
  const [, choice] = BACKWARD_POSITIONS.run([run.values.get('in')], {}, { task: level, node })
  assert.deepEqual(choice.hyps, [1])
})

test('rule and equation displays keep complete term wording', async () => {
  const { fn } = await import('../core/formula.js')
  const { sayTerm } = await import('../core/notation.js')
  const { typeText } = await import('../core/datatype.js')
  const { equationText, sideText } = await import('../core/schematic.js')
  const { rewriteText } = await import('../core/rewrite.js')
  const wording = (value) => sayTerm(value, { words: { zero: { zh: '零 = 0', en: 'zero = 0' } } }).en
  const zero = fn('zero')
  const y = tvar('y')

  assert.equal(equationText({ bound: ['y'], s: zero, t: y }, (side) => sideText(side, show, wording)), '⋀y. zero = 0 ≐ y')
  assert.equal(rewriteText({ conditions: [parse('A')], lhs: zero, rhs: y }, show, wording), '⟦A; C[zero = 0]⟧ ⟹ C[y]')
  assert.equal(ruleText(ruleOf('chain', null, ['A → B', 'B → C'], 'A → C')), '⟦A → B; B → C⟧ ⟹ A → C')
  assert.equal(ruleText(ruleOf('top', null, [], 'A → A')), '⟦⟧ ⟹ A → A')
  assert.equal(ruleText(ASSUMPTION_RULE), 'Γ, A ⊢ A')
  assert.equal(typeText('nat', 'zero | s(nat)', wording), 'nat = zero = 0 | s(nat)')
})

test('a declaration gives its rules, and induction read off a goal proves an equation for every number', async () => {
  const { datatypeRules } = await import('../core/datatype.js')

  const rules = Object.fromEntries(datatypeRules('nat', 'zero | s(nat)').map((r) => [r.key, ruleText(r)]))
  assert.deepEqual(Object.keys(rules), ['nat.distinct1', 'nat.distinct2', 'nat.exhaust', 'nat.induct'])
  assert.equal(rules['nat.induct'], '⟦?P(zero); (⋀x. ⟦?P(x)⟧ ⟹ ?P(s(x)))⟧ ⟹ ∀x. ?P(x)')
  const level = onMachine({
    kind: 'logic/machine', want: 'logic/proved', datatypes: { nat: 'zero | s(nat)' },
    defs: ['plus(zero, y) = y', 'plus(s(x), y) = s(plus(x, y))'],
    tests: [{ goal: '∀x. plus(x, zero) = x' }],
  })
  const byInduction = machine({
    i: ['logic/directBackward-math', { use: ['nat.induct'] }],
    e: ['each'], p: ['repeat', {}, 'e'],
    zero: ['logic/directRewrite-math', { use: ['def.0'] }, 'p'],
    succ: ['logic/directRewrite-math', { use: ['def.1'] }, 'p'],
    hyp: ['logic/directRewrite-logic_hyp', { use: ['hyp'] }, 'p'],
    r: ['logic/directBackward-refl', {}, 'e'],
  }, [
    'in>i', 'i>e', 'e#body>p', 'p#body>zero', 'zero>succ', 'succ>hyp', 'hyp>p.body',
    'p>r', 'r>e.body', 'e>out',
  ])
  assert.equal(runMachine(level, byInduction).pass, true)
})

test('clauses: split from a goal turned round, saturated with unification, and the certificate replayed', async () => {
  const { parseS } = await import('../core/schematic.js')
  const { KERNEL, rule, startState } = await import('../core/tactics.js')
  const { clauseText, clausesOfState, oracleRound, replay, saturate } = await import('../core/resolution.js')
  const why = (t) => new Error(t.en)
  const turned = (goal, hyps) => [KERNEL.raa, KERNEL.impI].reduce((s, r) => rule(s, r).results[0], startState(parseS(goal), hyps.map(parseS)))
  const s = turned('Anc(ann, cy)', ['∀x. ∀y. ∀z. ¬Anc(x, y) ∨ ¬Anc(y, z) ∨ Anc(x, z)', 'Anc(ann, bo)', 'Anc(bo, cy)'])
  const set = clausesOfState(s, why)
  assert.deepEqual(set.map(clauseText), ['¬Anc(x, y) ∨ ¬Anc(y, z) ∨ Anc(x, z)', 'Anc(ann, bo)', 'Anc(bo, cy)', '¬Anc(ann, cy)'])
  const done = saturate(set)
  assert.ok(done.set.some((c) => !c.lits.length))
  assert.equal(replay({ kind: 'clauses', set: done.set, from: s }).state.goals.length, 0)
  // A goal that is not ⊥ does not split; a prover that cancels two pairs at once is caught on replay.
  assert.throws(() => clausesOfState(startState(parseS('Wet')), why))
  const wrong = turned('Wet', ['Rain ∨ Wind', '¬Rain ∨ ¬Wind'])
  const fast = saturate(clausesOfState(wrong, why), { round: oracleRound })
  assert.match(replay({ kind: 'clauses', set: fast.set, from: wrong }).fail.en, /more than one opposite pair/)
  assert.equal(saturate(clausesOfState(wrong, why)).set.some((c) => !c.lits.length), false)
})

test('rewriting the hypotheses, under a binder without catching what is put in', async () => {
  const { parseS } = await import('../core/schematic.js')
  const { startState } = await import('../core/tactics.js')
  const { rewrite, rewriteBookOf, simplify } = await import('../core/rewrite.js')
  const lemmas = { dm: { name: { zh: '', en: '' }, metas: ['A', 'B', 'P'], forms: [
    { key: 'notEx', label: '', statement: '∀x. ¬P', premises: ['¬∃x. P'] },
    { key: 'allNot', label: '', statement: '¬∃x. P', premises: ['∀x. ¬P'] },
    { key: 'notAll', label: '', statement: '∃x. ¬P', premises: ['¬∀x. P'] },
    { key: 'exNot', label: '', statement: '¬∀x. P', premises: ['∃x. ¬P'] },
  ] } }
  const book = rewriteBookOf({ lemmas })
  const s = startState(parseS('⊥'), ['Human(soc)', '¬∀x. ∃y. Likes(y, x)'].map(parseS))
  const hyps = (r) => r.results[0].goals[0].hyps.map((h) => show(h))
  assert.deepEqual(hyps(simplify(s, [book['dm.notAll'], book['dm.notEx']], 'hyps')), ['Human(soc)', '∃x. ∀y. ¬Likes(y, x)'])
  assert.ok(rewrite(s, book['dm.notAll']).fail)
})

test('a script: each row by a rule or a block, checked row by row', async () => {
  const { checkScript, inspectScript } = await import('../core/script.js')
  const level = { premises: { p: 'Rain → Wet', q: 'Wet → Slip' }, goal: 'Rain → Slip' }
  const rows = (by) => [
    { k: 'show', stmt: 'Rain → Slip', by: 'proof' },
    { k: 'assume', stmt: 'Rain' },
    { k: 'have', stmt: 'Wet', using: ['p', 'a1'], by },
    { k: 'show', stmt: 'Slip', using: ['q', 'h1'], by: 'rule:mp' },
  ]
  assert.equal(checkScript(level, rows('rule:mp')).pass, true)
  const { fail, run } = inspectScript(level, rows('rule:conjI'))
  assert.equal(run.pass, false)
  assert.ok(run.rows[2] && !run.rows[3])
  assert.deepEqual(fail, { at: { row: 2 }, why: run.reason, check: 0 })
  assert.equal(checkScript(level, rows('rule:mp').slice(0, 3)).pass, false)
})

test('definitions check completion, then hidden examples, then decreasing recursion', () => {
  const judge = checkDefine({
    fn: 'add', on: 0,
    rows: [{ lhs: 'add(zero, y)' }, { lhs: 'add(s(x), y)' }],
    tests: [{ term: 'add(zero, s(zero))', value: 's(zero)' }],
  })
  assert.deepEqual(judge.checks, [])
  assert.match(judge(['y', '']).why.en, /whole right side/)
  const wrong = judge(['zero', 'add(s(x), y)'])
  assert.deepEqual(wrong.got, parseSide('zero'))
  assert.match(failureText(wrong).en, /but works out to zero/)
  assert.deepEqual(judge(['y', 'add(s(x), y)']).at, { row: 1, slot: 0 })
  assert.equal(judge(['y', 's(add(x, y))']), null)
})

test('declarations check incomplete premises before hidden derivability cases', () => {
  const judge = checkDeclaration({
    target: 'A ∧ B', sentences: ['A', 'B'], declare: { zh: '并且', en: 'and' },
    tests: [{ given: [], make: false }, { given: ['A', 'B'], make: true }],
  })
  assert.deepEqual(judge.checks, [])
  assert.deepEqual(judge([{ binds: [], needs: [null] }]).at, { row: 0, slot: 0 })
  assert.equal(judge([{ binds: [], needs: [] }]).got, true)
  assert.equal(judge([{ binds: [], needs: [parse('A'), parse('B')] }]), null)
})

test('a declaration may have no derivable situation: nothing introduces it, and its elim rule gives anything (⊥)', () => {
  const bot = { target: '⊥', sentences: ['A'], declare: { zh: '矛盾', en: 'contradiction' }, tests: [{ given: [], make: false }, { given: ['A'], make: false }] }
  assert.deepEqual(problemsOf(bot, []), [])
  assert.equal(checkDeclaration(bot)([]), null)
  const { make, take } = declaredRules(bot, [])
  assert.deepEqual([make.length, ruleText(take)], [0, '⟦⊥⟧ ⟹ ?R'])
})

test('an audit stops at an unfinished case before grading the supplied declarations', () => {
  const complete = { given: ['A', 'B'], make: true }
  const unfinished = { given: [], goal: '', make: null }
  const level = {
    target: 'A ∧ B', sentences: ['A', 'B'], declare: { zh: '并且', en: 'and' }, want: 'logic/agree',
    solution: declaration(['A', 'B']), boards: [{ rules: declaration() }],
  }
  const words = text => ({ zh: text, en: text })
  const blocked = runAudit(level, [complete, unfinished], words)
  assert.deepEqual(blocked.fail.at, { row: 1 })
  assert.match(blocked.fail.why.en, /Case 2 has no conclusion/)
  assert.deepEqual(blocked.runs[0].steps, [{}, { failed: blocked.fail.why }])
  const graded = runAudit(level, [complete], words)
  assert.deepEqual(graded.fail.at, { row: 0 })
  assert.deepEqual(graded.runs[0].steps, [{ failed: graded.fail.why }])
})

test('audit cases recover the task’s fixed cells and required premises from its form', () => {
  const form = { target: 'B', caseGoal: 'B', slots: [{ fixed: ['make'], make: true, keep: ['A'] }] }
  const authored = [{ given: ['A', 'C'], make: true }]
  assert.deepEqual(auditCaseProblems(form, authored), [])
  const saved = [{ given: ['C'], goal: 'A', make: false, fixed: ['given'] }]
  assert.deepEqual(auditCaseProblems(form, saved), [
    'a reference case drops a premise its case keeps',
    'a reference case changes a cell its case fixes',
    'a reference case breaks the goal the level fixes',
  ])
  assert.deepEqual(restoreAuditCases(form, saved), [{ given: ['A', 'C'], goal: 'B', make: true, fixed: ['make', 'goal'], keep: ['A'] }])
  assert.deepEqual(auditCaseProblems({ target: 'B' }, authored), [])
  assert.deepEqual(restoreAuditCases({ target: 'B' }, authored), [{ given: ['A', 'C'], goal: undefined, make: true, fixed: [] }])
})

test('a declaration checks the premises of each introduction rule in order', () => {
  const level = (target, sentences, tests) => ({ target, sentences, tests, declare: { zh: 'x', en: 'x' } })
  const words = (l) => ({ zh: l, en: l })
  const and = level('A ∧ B', ['A', 'B'], [{ given: ['A', 'B'], make: true }, { given: ['A'], make: false }, { given: ['B'], make: false }])
  const both = declaration(['A', 'B'])
  assert.equal(checkIso(and, words)(both), null)
  assert.deepEqual(derives(and, both, and.tests[0]).made.items.map((x) => x.n), [1, 2])
  assert.ok(checkIso(and, words)(declaration(['A'], ['B'])))
  const or = level('A ∨ B', ['A', 'B'], [{ given: ['A'], make: true }, { given: ['B'], make: true }, { given: [], make: false }])
  const apart = declaration(['A'], ['B'])
  assert.equal(checkIso(or, words)(apart), null)
  assert.equal(derives(or, apart, or.tests[1]).made.way, 2)
  const choice = level('A ∨ B', ['A', 'B', 'C', 'D'], [{ given: ['D'], make: true }])
  const four = declaration(['A'], ['B'], ['C'], ['D'])
  assert.equal(derives(choice, four, choice.tests[0]).made.way, 4)
  assert.equal(checkDeclaration(choice)(readRuleRows(choice, four)), null)
  assert.deepEqual(checkDeclaration(choice)(readRuleRows(choice, four.slice(0, 3))).check, 0)
  const bot = level('⊥', ['A'], [{ given: ['A'], make: false }, { given: [], make: false }])
  assert.equal(checkIso(bot, words)(declaration()), null)
})

test('declaration instances preserve quantified premises and keep witnesses in scope', () => {
  const given = '∀x. Human(x)'
  const different = '∀x. Human(ann)'
  const level = { target: 'C', things: ['ann'] }
  const rules = [{ binds: ['x'], needs: [given] }]
  const derived = (given) => derives(level, rules, { given: [given] }).derived
  assert.equal(derived(given), true)
  assert.equal(derived(different), false)
  assert.equal(follows(level, rules, { given: ['C'], goal: given }), true)
  assert.equal(follows(level, rules, { given: ['A', '¬A', 'A → ⊥'], goal: '⊥' }), true)

  const family = { target: '∀y. Human(x)', things: ['ann'] }
  const withWitness = [{ binds: ['x'], needs: ['Witness(x)'] }]
  assert.equal(derives(family, withWitness, { given: ['Witness(ann)'], goal: '∀z. Human(ann)' }).derived, true)
  assert.equal(derives(family, withWitness, { given: ['Witness(y)'], goal: '∀y. Human(y)' }).derived, false)
})

test('a rule can require a conditional premise and hand it back on elimination', () => {
  const level = { target: 'C', sentences: ['A → B', 'A', 'B'], declare: { zh: 'x', en: 'x' }, tests: [
    { given: ['A → B'], make: true }, { given: ['B'], make: false },
    { given: ['C', 'A'], goal: 'B', make: true }, { given: ['C'], goal: 'B', make: false },
  ] }
  const words = (l) => ({ zh: l, en: l })
  const rules = declaration(['A → B'])
  assert.equal(checkIso(level, words)(rules), null)
  assert.ok(checkIso(level, words)(declaration(['B'])))
  const { make, take } = declaredRules(level, rules)
  assert.equal(ruleText(make[0]), '⟦A → B⟧ ⟹ C')
  assert.equal(ruleText(take), '⟦C; ⟦A → B⟧ ⟹ ?R⟧ ⟹ ?R')
  const { make: [intro], take: elim } = declaredRules({ ...level, target: '∃y. Human(y)' }, [{ binds: ['x'], needs: ['Human(x)'] }])
  assert.equal(ruleText(intro), '⋀x. ⟦Human(x)⟧ ⟹ ∃y. Human(y)')
  assert.equal(ruleText(elim), '⟦∃y. Human(y); (⋀x. ⟦Human(x)⟧ ⟹ ?R)⟧ ⟹ ?R')
})

test('using a declaration: what follows is what every way in gives, a sentence nothing mentions standing for any', () => {
  const level = (target) => ({ target, sentences: ['A', 'B'], declare: { zh: 'x', en: 'x' } })
  const and = declaration(['A', 'B'])
  const or = declaration(['A'], ['B'])
  assert.ok(follows(level('A ∧ B'), and, { given: ['A ∧ B'], goal: 'A' }))
  assert.equal(follows(level('A ∧ B'), and, { given: ['A ∧ B'], goal: 'C' }), false)
  assert.ok(follows(level('A ∧ B'), and, { given: ['A ∧ B', 'A → (B → C)'], goal: 'C' }))
  // Declared as two ways, "and" no longer gives its left side.
  assert.equal(follows(level('A ∧ B'), or, { given: ['A ∧ B'], goal: 'A' }), false)
  assert.ok(follows(level('A ∨ B'), or, { given: ['A ∨ B', 'A → C', 'B → C'], goal: 'C' }))
  assert.equal(follows(level('A ∨ B'), or, { given: ['A ∨ B', 'A → C'], goal: 'C' }), false)
  assert.ok(follows(level('⊥'), declaration(), { given: ['⊥'], goal: 'C' }))
})

test('a ∀ over sentences: R is bound, a test case leaves it, a sentence goes in for it, and it is true when its body is for R true and false', async () => {
  const { parse, replaceAtoms, same, show, substSentence } = await import('../core/formula.js')
  const { holds } = await import('../core/models.js')
  const { lettersOf } = await import('../core/truth.js')
  const def = parse('∀R. (A → (B → R)) → R')
  assert.equal(def.prop, true)
  assert.deepEqual(lettersOf([def]), ['A', 'B'])
  assert.equal(show(replaceAtoms(def, { A: parse('Rain'), R: parse('Wet') })), '∀R. (Rain → B → R) → R')
  assert.equal(show(substSentence(def.body, 'R', parse('A'))), '(A → B → A) → A')
  assert.ok(same(def, parse('∀S. (A → (B → S)) → S')))
  assert.equal(holds(def, { domain: [0], preds: { A: true, B: true }, fns: {} }), true)
  assert.equal(holds(def, { domain: [0], preds: { A: true, B: false }, fns: {} }), false)
})

test('choosing a sentence instance keeps the inserted names free', async () => {
  const { mentionsSentence, freeVars, substSentence } = await import('../core/formula.js')
  const proof = (text) => ({ formula: parse(text), hyps: new Map(), term: { k: 'const', name: 'h' } })
  const choose = (text, instance) => RULES.allE.run([proof(text)], {}, { node: { params: { t: instance } } }).formula

  const sentence = choose('∀R. ∀S. R', 'S')
  assert.ok(mentionsSentence(sentence, 'S'))
  assert.ok(same(sentence, parse('∀T. S')))
  const individual = choose('∀R. ∀x. R', 'Human(x)')
  assert.deepEqual([...freeVars(individual)], ['x'])
  assert.ok(same(individual, parse('∀y. Human(x)')))

  const shadowed = substSentence(parse('∀R. R'), 'R', parse('S'))
  assert.ok(same(shadowed, parse('∀R. R')))
  const property = substSentence(parse('∀x. R(x)'), 'R', parse('Human(x)'))
  assert.ok(same(property, parse('∀y. Human(y)')))
  const nested = substSentence(parse('∀S. ∀S1. R ∧ S'), 'R', parse('S'))
  assert.ok(same(nested, parse('∀T. ∀U. S ∧ T')))
})

test('a ∀ over properties: P(t) takes a sentence about x with t in its place, and it holds when its body does for every set', async () => {
  const { parse, same, show, signature, substSentence } = await import('../core/formula.js')
  const { holds } = await import('../core/models.js')
  const { choicesOf } = await import('../core/choices.js')
  const consts = ['phos', 'hesp']
  const leib = parse('∀P. P(phos) → P(hesp)', { consts })
  assert.equal(show(substSentence(leib.body, 'P', parse('Q(x) → Q(phos)', { consts }))), '(Q(phos) → Q(phos)) → Q(hesp) → Q(phos)')
  assert.ok(same(leib, parse('∀Q. Q(phos) → Q(hesp)', { consts })))
  assert.deepEqual([...signature([leib]).preds.keys()], [])
  const m = (h) => ({ domain: [0, 1], preds: {}, fns: { phos: new Map([['', 0]]), hesp: new Map([['', h]]) } })
  assert.equal(holds(leib, m(0)), true)
  assert.equal(holds(leib, m(1)), false)
  const ind = parse('∀P. P(zero) → (∀n. P(n) → P(s(n))) → (∀n. P(n))', { consts: ['zero'] })
  assert.equal(show(substSentence(ind.body, 'P', parse('x = zero ∨ (∃m. x = s(m))', { consts: ['zero'] }))).includes('∀n. n = zero ∨ (∃m. n = s(m))'), true)
  const level = { consts, tests: [{ premises: { e: '∀P. P(phos) → P(hesp)' }, goal: '∀Q. Q(hesp) → Q(phos)' }] }
  assert.ok(choicesOf(level).instance.includes('Q(x) → Q(phos)'))
})

test('written and authored rule rows use the same premises and binder', () => {
  const level = { sentences: ['Human(x)', 'Rain → Wet'], target: '∃y. Human(y)', thing: true, notation: { words: {} }, tests: [] }
  assert.deepEqual(premiseChips(level).map((c) => c.key).sort(), ['P:Human', 'P:Rain', 'P:Wet', 'v:x', '→'].sort())
  const human = parse('Human(x)')
  assert.deepEqual(problemsOf(level, [{ binds: [], needs: [null] }]), [{ row: 0, slot: 0, why: 'empty' }])
  // A thing alone where a sentence goes is not a sentence yet.
  assert.deepEqual(problemsOf(level, [{ binds: ['x'], needs: [tvar('x')] }]), [{ row: 0, slot: 0, why: 'empty' }])
  assert.deepEqual(problemsOf(level, [{ binds: [], needs: [human] }]), [{ row: 0, slot: 0, why: 'stray' }])
  const rules = [{ binds: ['x'], needs: [human] }]
  assert.deepEqual(problemsOf(level, rules), [])
  assert.deepEqual(linesOf(rules), [{ binds: ['x'], needs: ['Human(x)'] }])
  assert.deepEqual(readRuleRows(level, linesOf(rules)), rules)
  const judge = checkDeclaration(level)
  assert.deepEqual(judge(readRuleRows(level, [{ binds: ['y'], needs: [] }])).at, { row: 0 })
  assert.deepEqual(judge(readRuleRows(level, [{ binds: ['x', 'x'], needs: [] }])).at, { row: 0 })
  const unavailable = judge(readRuleRows(level, declaration(['Snow'])))
  assert.deepEqual(unavailable.at, { row: 0, slot: 0 })
  assert.match(unavailable.why.en, /not on offer: P:Snow/)
})

function bindMachineCards(task) {
  const cards = directCardsOf(task)
  const { PARTS } = compileParts(Object.fromEntries([...cards].map(([type, card]) => [type, card.definition])), OPS)
  task.parts = type => PARTS[type] ?? machineParts(type)
  return cards
}

test('forward cards project only eligible rule shapes and keep the three variants in order', () => {
  const law = { name: { en: 'Law', zh: '定律' }, metas: ['A', 'B'], forms: [
    { key: 'elim', label: '', statement: 'A', premises: ['¬¬A'] },
    { key: 'intro', label: '', statement: '¬¬A', premises: ['A'] },
    { key: 'duplicate', label: '', statement: 'B', premises: ['¬¬B'] },
  ] }
  const level = { directRuleCards: true, lemmas: { law }, rules: {
    given: { name: 'Local', premises: ['P'], conclusion: 'Q' },
    axiom: { name: 'Axiom', premises: [], conclusion: 'P' },
  }, withheldRuleChoices: new Set(['mp.use=mp', 'andE.use=conjE', 'allE.use=spec']) }
  const cards = directCardsOf(level)
  for (const [source, keys] of Object.entries({
    mp: ['mp'], andE: ['conjE'], allE: ['spec'], orE: ['disjE'], exE: ['exE'], botE: ['botE'],
    raa: ['raa'], andI: ['conjI'], orI: ['disjI1', 'disjI2'], exI: ['exI'], given: ['given'],
  })) {
    const card = cards.get(`logic/directForward-${source}`)
    assert.equal(card.direction, 'forward')
    assert.equal(card.definition.op, 'logic/directForward')
    assert.ok(card.definition.name.en.startsWith('\\mark{forward} '))
    assert.deepEqual(card.entries.map(entry => entry.key), keys)
    assert.equal(card.defaultRule, keys.length === 1 ? keys[0] : null)
  }
  for (const source of ['impI', 'allI', 'refl', 'logic_assumption', 'axiom']) {
    assert.ok(!cards.has(`logic/directForward-${source}`))
  }
  assert.deepEqual([...cards.values()].filter(card => card.source === 'law').map(card => card.direction),
    ['backward', 'forward', 'rewrite'])
  assert.deepEqual(cards.get('logic/directForward-law').entries.map(entry => entry.key), ['law.elim', 'law.intro'])
})

test('forward application adds givens, skips a missing premise or duplicate, and can pin the major given', () => {
  const type = 'logic/directForward-mp'
  const level = { directRuleCards: true, want: 'logic/becomes', tests: [
    { goal: 'Goal', hyps: ['P → Q', 'R → S', 'P', 'R', 'Q'], becomes: [['P → Q; R → S; P; R; Q; S ⊢ Goal']] },
    { goal: 'Goal', hyps: ['P → Q'], becomes: [['P → Q ⊢ Goal']] },
    { goal: 'Goal', hyps: ['P → Q', 'P', 'Q'], becomes: [['P → Q; P; Q ⊢ Goal']] },
  ] }
  bindMachineCards(level)
  const board = machine({ step: [type] }, ['in>step', 'step>out'])
  const node = board.nodes.find(node => node.id === 'step')
  const report = runMachine(level, board, { traced: true })
  assert.equal(report.pass, true)
  const cases = report.runs.map(run => [run.values.get('in')])
  assert.deepEqual(report.runs.map(run => [run.trace[0].status, run.trace[0].reason]), [
    ['applied', undefined], ['skipped', 'rule-mismatch'], ['skipped', 'nothing-new'],
  ])
  assert.deepEqual(report.runs[0].trace[0].diff.addedHyps, [{ goalIndex: 0, hyp: 5 }])
  const [applied, ...skipped] = report.runs
  const { zh, en } = stepExplained(applied.trace[0], applied)
  assert.match(zh, /R₁/)
  assert.match(en, /R₁/)
  assert.notEqual(zh, en)
  for (const run of skipped) assert.equal(stepExplained(run.trace[0], run), null)
  assert.deepEqual(machinePositionCases(level, node, cases).map(({ value, cases }) => [value, cases.map(c => c.exists)]),
    [['hyp-1', [true, false, false]]])
  assert.deepEqual(machineConfigurationCases(level, node, cases), cases.map(() => ({ pending: false, reason: null })))
  node.params.at = 'hyp-0'
  assert.deepEqual(runMachine(level, board, { traced: true }).runs.map(run => run.trace[0].reason),
    ['nothing-new', 'rule-mismatch', 'nothing-new'])
  node.params.at = 'hyp-2'
  const pinned = runMachine(level, board, { traced: true }).runs[0]
  assert.equal(pinned.trace[0].reason, 'position-missing')
  assert.deepEqual(pinned.values.get('in').goals, pinned.outputs.out.goals)
  node.params.at = 'hyp-1'
  assert.equal(runMachine(level, board, { traced: true }).runs[0].pass, true)
})

test('forward position previews and backtracking keep all combinations under the same pin', () => {
  const type = 'logic/directForward-mp'
  const level = { directRuleCards: true, want: 'logic/proved', backtrack: true, tests: [
    { goal: 'Goal', hyps: ['∀x. P(x) → Q(x)', 'P(i)', 'P(j)', 'P(k)'] },
  ] }
  bindMachineCards(level)
  const board = machine({ spec: ['logic/directForward-allE'], step: [type, { at: 'hyp-4' }] },
    ['in>spec', 'spec>step', 'step>out'])
  const node = board.nodes.find(node => node.id === 'step')
  const run = runMachine(level, board, { traced: true }).runs[0]
  const input = [run.values.get('spec')]
  const [header, ...choices] = OPS['logic/forwardPositions'].run(input, {}, { task: level, node })
  assert.equal(header.defaultAt, 'hyp-4')
  assert.deepEqual(choices.map(c => [c.value, c.indices, c.isDefault, show(c.addedHyps[0].hyps[0])]), [
    ['hyp-4', [4, 1], true, 'Q(i)'], ['hyp-4', [4, 2], false, 'Q(j)'], ['hyp-4', [4, 3], false, 'Q(k)'],
  ])
  assert.deepEqual(machinePositionCases(level, node, [input])[0].cases[0].choices, choices)
  assert.deepEqual([run.outputs.out, ...run.outputs.out.more].map(result => result.goals), choices.map(choice => choice.result))
  const first = runMachine({ ...level, backtrack: false }, board).runs[0].outputs.out
  assert.equal(first.more, undefined)
  assert.deepEqual(first.goals, choices[0].result)
})

test('forward matching reads plain premises after a box and resolves patterns jointly', () => {
  const level = { directRuleCards: true, want: 'logic/becomes', rules: {
    scoped: { name: 'Scoped', premises: ['⟦Guard⟧ ⟹ Pending', '?P(?t)', '∀x. ?P(x)', 'Anchor(?t)'], conclusion: 'Done(?t)' },
  }, tests: [{ goal: 'Goal', hyps: ['P(i)', '∀x. P(x)', 'Anchor(i)'],
    becomes: [['P(i); ∀x. P(x); Anchor(i); Guard ⊢ Pending', 'P(i); ∀x. P(x); Anchor(i); Done(i) ⊢ Goal']] }] }
  bindMachineCards(level)
  const board = machine({ f: ['logic/directForward-scoped'] }, ['in>f', 'f>out'])
  const run = runMachine(level, board, { traced: true }).runs[0]
  assert.equal(run.pass, true)
  assert.deepEqual(run.trace[0].value.did.givens, [0, 1, 2])
  assert.deepEqual(run.trace[0].diff.addedHyps, [{ goalIndex: 0, hyp: 3 }, { goalIndex: 1, hyp: 3 }])
})

test('forward elimination replaces the first goal in place and handles duplicate context and closure', () => {
  const level = { directRuleCards: true, want: 'logic/becomes', tests: [
    { goal: 'Goal ∧ Tail', hyps: ['P ∨ Q'], becomes: [['P ∨ Q; P ⊢ Goal', 'P ∨ Q; Q ⊢ Goal', 'P ∨ Q ⊢ Tail']] },
    { goal: 'Goal ∧ Tail', hyps: ['P ∨ Q', 'P'], becomes: [['P ∨ Q; P ⊢ Goal', 'P ∨ Q; P ⊢ Tail']] },
    { goal: 'Goal ∧ Tail', hyps: ['⊥'], becomes: [['⊥ ⊢ Tail']] },
  ] }
  bindMachineCards(level)
  const board = machine({
    split: ['logic/directBackward-andI'], cases: ['logic/directForward-orE'], close: ['logic/directForward-botE'],
  }, ['in>split', 'split>cases', 'cases>close', 'close>out'])
  const report = runMachine(level, board, { traced: true })
  assert.equal(report.pass, true)
  const step = (index, id) => report.runs[index].trace.find(entry => entry.id === id)
  assert.deepEqual(step(0, 'cases').diff.addedHyps, [{ goalIndex: 0, hyp: 1 }, { goalIndex: 1, hyp: 1 }])
  assert.equal(step(1, 'cases').reason, 'nothing-new')
  assert.deepEqual(step(2, 'close').diff.closed, [0])
  assert.deepEqual(step(2, 'close').diff.addedHyps, [])
})

test('forward novelty ignores renamed unknowns and consistently renamed fresh witnesses', () => {
  const level = { directRuleCards: true, want: 'logic/becomes', tests: [
    { goal: 'Goal', hyps: ['∀x. P(x)'], becomes: [['∀x. P(x); P(?t) ⊢ Goal']] },
    { goal: 'Goal', hyps: ['∃x. Pair(x, x)', 'Pair(k, k)'], becomes: [['∃x. Pair(x, x); Pair(k, k) ⊢ Goal']] },
    { goal: 'Goal', hyps: ['∃x. Pair(x, x)', 'Pair(a, k)'], becomes: [['⋀b. ∃x. Pair(x, x); Pair(a, k); Pair(b, b) ⊢ Goal']] },
    { goal: 'Goal', hyps: ['∀x. P(x, x)', 'P(?t, ?u)'], becomes: [['∀x. P(x, x); P(?t, ?u); P(?v, ?v) ⊢ Goal']] },
  ] }
  bindMachineCards(level)
  const board = machine({
    loop: ['repeat'], spec: ['logic/directForward-allE', {}, 'loop'], witness: ['logic/directForward-exE', {}, 'loop'],
  }, ['in>loop.in', 'loop#body>spec', 'spec>witness', 'witness>loop.body', 'loop>out'])
  const report = runMachine(level, board, { traced: true })
  assert.equal(report.pass, true)
  assert.ok(report.runs[0].trace.some(step => step.id === 'spec' && step.reason === 'nothing-new'))
  assert.ok(report.runs[1].trace.some(step => step.id === 'witness' && step.reason === 'nothing-new'))
})

test('forward sentence unknowns survive search while rule selection is still required', () => {
  const type = 'logic/directForward-orI'
  const level = { directRuleCards: true, want: 'logic/proved', backtrack: true, tests: [{ goal: 'P ∨ Q', hyps: ['P'] }] }
  bindMachineCards(level)
  const board = machine({
    search: ['search', { depth: '2' }], derive: [type, {}, 'search'],
    cite: ['logic/directBackward-logic_assumption', {}, 'search'], join: ['append', {}, 'search'],
  }, ['in>search.in', 'search#body>derive', 'search#body>cite', 'cite>join.first', 'derive>join.second', 'join>search.body', 'search>out'])
  const node = board.nodes.find(node => node.id === 'derive')
  assert.deepEqual(machineConfigurationCases(level, node, [[]]), [{ pending: true, reason: 'rule-required' }])
  assert.equal(runMachine(level, board).pass, false)
  node.params.use = ['disjI1']
  assert.equal(runMachine(level, board).pass, true)
})

test('a forward match cannot fill an older unknown through a newer alias outside its scope', () => {
  const older = parseSide('?t')
  const alias = parseSide('?u')
  const witness = parseSide('a')
  const { σ } = unify([[older, alias]])
  const scopes = { '?t': [], '?u': ['a'] }
  assert.ok(unify([[alias, witness]], σ, { scopes, fixed: ['a'] }).fail)
  assert.equal(unify([[alias, witness]], σ, { scopes: { ...scopes, '?t': ['a'] }, fixed: ['a'] }).fail, undefined)
})
