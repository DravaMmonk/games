import { mark } from 'notation'
import { ruleImplementations } from './rule-implementations.js'
import { T as catalogText } from 'kernel/words'
import { workNodes } from 'circuit'
import { countMachineSteps, finishProof, machineEvents, proofStep, stopProof, traceFlow, traceProof } from './proof-tree.js'
// The machine board (《证明完毕》 chapter 8 on): a circuit whose wires carry proof states, rule lists or
// clause sets instead of proved judgments. Its sources (`in` cards, one per input the level names) give the test's
// inputs, its sink `out` is checked against what the level wants. A part is a tactic, a frame
// that runs what it holds again and again (repeat, depth-first search, every goal), a junction for alternative
// routes, a rewrite, or a step on clauses (resolution.js); the level's parts come from the course as
// on every board. A part the player builds (erule, frule, the introduction and elimination steps, auto,
// simp, the clause machines) runs the board that built it: the player's, as it last passed (builtMachine).
//
//   value   { kind: 'state', … } (tactics.js)
//           | { kind: 'clauses', set, from?, endless? } (resolution.js) | { kind: 'rules', keys, entries }
//   level   { kind: 'logic/machine', want, inputs?: [{ name, label }] (default one, `in`),
//             rules?: { key: { name, premises: [text], conclusion: text } }, backtrack?,
//             tests: [{ goal, hyps?, answers?, becomes?, clauses?, budget? }
//             | { clauses: [clause text], budget? }, want?] }
//
// Output checks include 'proved' (no goal left), 'becomes' (the results the test lists, each with its
// goals written '⋀a. h1; h2 ⊢ goal', its ?-letters named as the machine likes: none, for a step that must fail),
// 'answers' (every way of proving the goal, as a
// question's answers: the test's `answers`, the things its ?-letters become), 'fails' (the goal cannot be proved, and
// the machine says so, having stopped); on clauses (chapter 11), 'clauses' (the clause set the test lists, from a goal),
// 'refuted' (a clause set holding ⊥, within the test's `budget` of clauses when it has one) and 'decide' (⊥ when the
// clauses cannot all hold, saturated without it when they can).
//
// Rewriting (chapter 10, rewrite.js): the rewrite card uses one rule of the level's rewrite book (rewriteBookOf: laws
// proved both ways, the level's `defs`, the goal's hypotheses) once; simp, which the player builds, uses a list of
// them until none fits. Both rewrite the goal, or (chapter 11, the card's `at`) its hypotheses.
//
// Rules are parts (rulePartsOf): every rule of the level's books is given by a rule part, the part the rule belongs to
// (a kernel rule's proof-board part, a lemma, the level's own axiom, an equation given). Numbers and lists (chapter 12)
// are one part, the rule book of numbers (MATH): the rules the level's datatypes give, its definitions' equations and
// the equations proved so far (the course's facts, a level's `proven`). A rule part gives a list of rules: those wired into it (`before`), then its own (those
// added on it, `use`, in the order they were added, when it has several; its first until any is). A card that uses rules (rule, erule, frule, rw, simp) reads the list
// on its port `rules`: the first that applies, in order (with backtracking, each one's results in turn); simp the
// whole list, in order. A rule list is a constant: it may be wired into a frame from outside. Until a level says
// `backtrack`, a tactic gives only its first result; from then on, every result, and each card after it works on each
// of them in turn (tactics.js).
import { sameJson } from 'kernel'
import { OperationError } from 'kernel'
import { packed, runBoard } from 'circuit'
import { runOutputTests } from 'kernel'
import { FORMULA_TEXT, all, fn, subst, tvar } from './formula.js'
import { KERNEL, answerOf, asValue, defer, depthFirst, resultsOf, rule, startState } from './tactics.js'
import { ASSUMPTION_RULE, instantiate, lemmaRules, parseS, ruleOf, ruleText, sideText, stated } from './schematic.js'
import { lemmaRewrites, localRewrites, rewrite, rewriteBookOf, rewriteText, simplify } from './rewrite.js'
import { datatypesRules } from './datatype.js'
import { clausesOfState, oracleRound, parseClause, refuted, replay, resolveRound, saturate } from './resolution.js'
import { L } from "kernel"
import { T } from 'kernel/words'
import { circuitBoard } from 'circuit'
import { say } from './notation.js'

const fail = (zh, en) => new OperationError({ zh, en })
export const clausesValue = (set, extra = {}) => ({ kind: 'clauses', set, ...extra })

const books = new WeakMap()
/**
 * A level's rule book: every rule a card may name, by key: the kernel's, those its datatypes give (datatype.js), each
 * lemma's shapes, the equations proved it holds (`facts`, those in `proven`) and the level's own. A
 * level of a course (`holds`: the parts it can hold, `forms`: the shapes each lemma has there, course.js) has a kernel
 * rule once it holds its part, and a lemma once the lemma is built, in the shapes it has gained.
 */
export function ruleBookOf(level) {
  if (!books.has(level)) {
    const has = (p) => !level.holds || level.holds.includes(p)
    const own = Object.entries(level.rules ?? {}).map(([key, r]) => ({ ...ruleOf(key, r.name, r.premises ?? [], r.conclusion), own: true }))
    const shaped = (type, l) => (r) => !l.forms || !level.forms?.[type] || level.forms[type].includes(r.key.split('.')[1] ?? l.forms[0].key)
    const lemmas = Object.entries(level.lemmas ?? {}).filter(([type]) => has(type)).flatMap(([type, l]) => lemmaRules(type, l).filter(shaped(type, l)))
    const facts = factsOf(level).map(([type, f]) => ({ ...ruleOf(type, f.name, f.rule?.premises ?? [], f.rule?.conclusion ?? f.statement), fact: true }))
    const contextRules = has(ASSUMPTION_RULE.part) && level.kind !== 'logic/script' ? [ASSUMPTION_RULE] : []
    books.set(level, Object.fromEntries([...contextRules, ...Object.values(KERNEL).map((r) => ({ ...r, part: level.ruleParts?.[`logic/${r.part}`] ?? r.part })).filter((r) => has(r.part)), ...datatypesRules(level.datatypes), ...lemmas, ...facts, ...own].map((r) => [r.key, r])))
  }
  return books.get(level)
}

/** A list of rules, by key in the level's books (rule parts give these), with each one's entry ({ book, rule }) to write
 *  it out; `own`: how many at its end the rule part that gives it adds (its card shows only those). */
export const rulesValue = (entries, own) => ({ kind: 'rules', keys: entries.map((e) => e.key), entries, ...(own !== undefined && { own }) })
const rulesIn = (v) => {
  if (v?.kind !== 'rules') throw fail('「规则」口要接规则元件', 'The rules port takes rule parts')
  return v
}
/** The equations proved that a level holds: [type, fact], those in its `proven` (every one, outside a course). */
export const factsOf = (level) => Object.entries(level.facts ?? {}).filter(([type]) => !level.proven || level.proven.includes(type))
/** The rule book of numbers: one part for every rule of the numbers and lists a level has. */
export const MATH = 'math'
// A rule part's type for a key: what part the rule belongs to.
const partOfRule = (r) => (r.datatype || r.fact ? MATH : r.part ?? r.lemma ?? r.key)
const partOfRewrite = (r) => (r.group === 'law' ? r.key.split('.')[0] : r.group === 'def' || r.group === 'fact' ? MATH : r.key === 'hyp' ? 'logic/hyp' : r.key)
// The rule book of numbers lists the declarations' rules, then the definitions, then the equations proved.
const mathRank = (e) => (e.rule.datatype ? 0 : e.rule.group === 'def' ? 1 : 2)
/**
 * The rule parts a level states for itself, its axioms: its own rules (`rules`), and the rule book of numbers when it
 * declares a datatype or defines something. They are parts of the level that states them (course.js, local).
 */
export const axiomPartsOf = (level) => [
  ...Object.keys(level.rules ?? {}),
  ...(level.datatypes || level.defs?.length ? [MATH] : []),
]
const partBooks = new WeakMap()
/**
 * The rule parts a level has: type → [{ key, book: 'rule' | 'rewrite', rule }], every rule of its rule book and its
 * rewrite book under the part it belongs to (a law proved both ways is a rule and a rewrite rule of the same part).
 */
export function rulePartsOf(level) {
  if (!partBooks.has(level)) {
    const out = new Map()
    const put = (type, entry) => {
      if (!out.has(type)) out.set(type, [])
      if (!out.get(type).some((e) => e.key === entry.key && e.book === entry.book)) out.get(type).push(entry)
    }
    for (const r of Object.values(ruleBookOf(level))) put(partOfRule(r), { key: r.key, book: 'rule', rule: r })
    for (const r of Object.values(rewriteBookOf(level))) put(partOfRewrite(r), { key: r.key, book: 'rewrite', rule: r })
    if (out.has(MATH)) out.set(MATH, out.get(MATH).map((e, i) => [e, i]).sort(([a, i], [b, j]) => mathRank(a) - mathRank(b) || i - j).map(([e]) => e))
    partBooks.set(level, out)
  }
  return partBooks.get(level)
}
/** The rule part a key of the level's books belongs to, and the choice on it that gives that key. */
export function rulePartOf(level, key) {
  for (const [type, entries] of rulePartsOf(level)) if (entries.some((e) => e.key === key)) return { type, use: choicesOfPart(entries).length > 1 ? [key] : null }
  return null
}
/** The keys a rule part offers to choose from (a law is one choice, rule and rewrite rule alike). */
export const choicesOfPart = (entries) => [...new Set(entries.map((e) => e.key))]
/** The keys a rule part gives of its own: its one rule when it has one; else those added on it (`use`), in that order. */
export const ownRules = (entries, use) => {
  const keys = choicesOfPart(entries)
  return keys.length === 1 ? keys : (use ?? []).filter((k) => keys.includes(k))
}
/** A rule part: the list wired into it (`before`), then its own rules. */
const RULE_PART = {
  inputs: ['before'],
  eval: ({ before }, node, ctx) => {
    const entries = ctx.ruleParts?.get(node.type)
    if (!entries) throw fail('这一关没有这条规则', 'This level has no such rule')
    const own = ownRules(entries, node.params?.use).map((k) => entries.find((e) => e.key === k))
    if (!own.length) throw fail('这块规则元件没有加上规则', 'This rule part has no rule added')
    return rulesValue([...(before ? rulesIn(before).entries : []), ...own], own.length)
  },
}

const stateIn = (v) => {
  if (v.kind !== 'state') throw fail('这里要一个证明状态（还没证完的目标）', 'This needs a proof state (the goals still open)')
  return v
}
const firstOf = (s) => ({ ...s, more: undefined })
// What a tactic did, for the step log (`did`, said of the card `didBy`): what it did (`op`), the rules it used (their
// keys; the log numbers them as the board does, R₁ R₂ …) and how many goals it was handed (one goal is plain ⊢, more are
// ⊢₁ ⊢₂ …; a tactic works on the first). ./circuit-readouts.js didText writes it.
const keysOf = (by) => [...new Set(by.map((b) => b.rule))]
const DID = {
  rule: (by) => {
    const rules = keysOf(by)
    return { op: rules.length === 1 && rules[0] === ASSUMPTION_RULE.key ? 'assumption' : 'rule', rules }
  },
  rw: (by, node) => ({ op: atOf(node) === 'hyps' ? 'rwHyps' : 'rw', rules: keysOf(by) }),
}
const unsaid = (s) => (s.did === undefined && s.didBy === undefined ? s : { ...s, did: undefined, didBy: undefined })
// A tactic card: on each result it is handed (only the first, until the level backtracks), every result it makes; a
// failure is the state with what went wrong (a frame reads it). An input that failed passes through.
const tactic = (t, say, { work = true } = {}) => ({
  inputs: ['in'],
  eval: ({ in: v }, node, ctx) => {
    const s = stateIn(v)
    if (s.error) { traceFlow(ctx, node); return unsaid(s) }
    const out = []
    let applied = 0
    let failed = null
    let attempted = false
    const record = work ? proofStep : (_ctx, _node, _from, value) => value
    for (const one of ctx.backtrack ? resultsOf(s) : [firstOf(s)]) {
      if (!one.goals.length) {
        out.push(unsaid(one))
        continue
      }
      if (applied >= 24) continue
      const r = t(one, ctx, node)
      const note = (by) => say && { ...say(by ? [by] : [], node), goals: one.goals.length }
      for (const { by, state, error } of r.attempts ?? (r.fail ? [{ error: r.fail }] : r.results.map(state => ({ state })))) {
        if (error) {
          const bad = { ...unsaid(one), error }
          const value = by ? record(ctx, node, one, bad, note(by)) : bad
          attempted ||= Boolean(by)
          failed ??= value
        } else {
          out.push({ ...record(ctx, node, one, unsaid(state), note(by)), by })
          attempted = true
          applied++
          if (!ctx.backtrack) break
        }
      }
    }
    const by = out.map((x) => x.by).filter(Boolean)
    if (!work || !attempted) traceFlow(ctx, node)
    const did = applied && say && { ...say(by, node), goals: s.goals.length }
    const made = asValue(out.map(({ by: _by, ...x }) => x), failed)
    const said = did && out.length ? { ...made, did, didBy: node.id } : made
    return s.endless ? { ...said, endless: true } : said
  },
})
// The rules wired into a card, from the book it uses: every one of them must be there.
function wired(v, book, misfit) {
  return rulesIn(v).keys.map((k) => {
    if (!book?.[k]) throw fail(...misfit)
    return book[k]
  })
}
const NOT_RULE = ['接进来的有一条不是推理规则（是改写用的等式）', 'One of the rules wired in is not an inference rule (it is an equation for rewriting)']
const NOT_REWRITE = ['接进来的有一条不能用来改写（只有等价、等式和定义能改写）', 'One of the rules wired in cannot rewrite (only equivalences, equations and definitions can)']
// A card that uses rules: each wired in, in order; the first that applies (with backtracking, each one's results).
function firstThatApplies(rules, ctx, apply) {
  const attempts = []
  for (const r of rules) {
    const got = apply(r)
    const by = { rule: r.key }
    if (got.fail) attempts.push({ error: got.fail, by })
    else {
      attempts.push(...got.results.map(state => ({ state, by })))
      if (!ctx.backtrack) break
    }
  }
  return attempts.length ? { attempts } : { fail: T('没有一条规则用得上') }
}
// A tactic card reading its rules from the port `rules` as well as the state from `in`.
const usesRules = (t, say) => {
  const card = tactic((s, ctx, node) => t(s, ctx, node, ctx.wiredRules), say)
  return { inputs: ['in', 'rules'], eval: ({ in: v, rules }, node, ctx) => card.eval({ in: v }, node, { ...ctx, wiredRules: rules }) }
}
const ruleCard = (t, say) => usesRules((s, ctx, _node, rules) => firstThatApplies(wired(rules, ctx.rules ?? KERNEL, NOT_RULE), ctx, (r) => t(s, r)), say)
// Where a rewrite card rewrites: the goal, or the hypotheses.
const atOf = (node) => (node.params?.at === 'hyps' ? 'hyps' : 'goal')
const rewriteAt = (s, r, node) => rewrite(s, r, atOf(node))

/** Run the rules bound to this card on the incoming proof state. */
const directCard = (apply, note) => tactic((s, ctx, node) => {
  const entries = ctx.directCards.get(node.type)?.entries ?? []
  const rules = ownRules(entries, node.params?.use).slice(0, 1).map(key => entries.find(entry => entry.key === key).rule)
  if (!rules.length) return { fail: T('请先在元件上选一条规则。') }
  return firstThatApplies(rules, ctx, r => apply(s, r, node))
}, note)
// A step inside a part, for a traced run (../../engine/circuit.js): a round of it, or the card it applies (`sub`).
const inner = (ctx, node, value, extra) => ctx?.trace?.push({ id: node.id, key: null, inner: true, value, ...extra })
const clausesIn = (v) => {
  if (v.kind !== 'clauses') throw fail('这里要一组子句：先用析出子句把证明状态化为子句', 'This needs a clause set: split the proof state into clauses first')
  return v
}
/**
 * The repeat frame: what its region makes from the value it opens with is fed back in, again and again, until it
 * stops changing (or a clause set holds ⊥, no goal is left, or a tactic fails: then the round
 * before stands). On proof states it follows the first result only. Its region shows the first round; the frame gives
 * the last.
 */
const repeat = {
  inputs: ['in', 'body'],
  eval: ({ in: v, body }, node, ctx, key) => {
    traceFlow(ctx, node, key ?? null)
    if (key) return v
    const first = (x) => (x.kind === 'state' ? firstOf(x) : x)
    const over = (x) => (x.kind === 'clauses' && refuted(x.set)) || (x.kind === 'state' && (x.error || !x.goals.length))
    // Comparing states is a decision. Forwarding a completed or failed proof needs no comparison.
    const decide = (out, value, decision) => {
      const step = { inner: true, label: out ? OUT : AGAIN, transient: true, decision }
      if (ctx.proof) return proofStep(ctx, node, value, value, null, step)
      inner(ctx, node, value, step)
      return value
    }
    let cur = first(v)
    const done = value => value.kind === 'clauses' ? decide(true, value, 'refuted') : value
    if (over(cur)) return done(cur)
    const round = ctx.region('body')
    for (let k = 0; k < 60; k++) {
      // The board's own pass was the first round; the rest run here.
      const next = k === 0 ? first(body) : first(round(cur))
      // A round that fails, or changes nothing, ends it on what it had; one that finishes the work, on that.
      if (next.kind === 'state' && next.error) return cur
      if (over(next)) return done(next)
      if (sameJson(unsaid(next), unsaid(cur))) return decide(true, cur)
      cur = decide(false, next)
    }
    throw fail('转了 60 圈还没停下来', 'Still changing after 60 rounds')
  },
}

// The frame's two decisions, in marks (./tex.js): once more ↻, out ↪.
const AGAIN = '↻'
const OUT = '↪'

const LIMIT = 250
/**
 * Depth-first search: what the region makes of each result it is handed, and of each result of that, deeper and
 * deeper, every state with no goal left found, in order. A path stops at the card's depth, when it has one.
 */
const search = {
  inputs: ['in'],
  eval: ({ in: v }, node, ctx, key) => {
    traceFlow(ctx, node, key ?? null)
    if (key) return v
    const s = stateIn(v)
    if (s.error || (!s.goals.length && !s.more?.length)) return s
    const round = ctx.region('body')
    const depth = Number(node.params?.depth) || Infinity
    const expand = (x) => {
      const out = round(x)
      return out.error ? [] : resultsOf(out)
    }
    const onStop = ctx.proof ? (value, reason) => stopProof(ctx, value, reason) : undefined
    const onCompare = (value, pruned) => proofStep(ctx, node, value, value, { op: 'searchCheck', pruned }, { key: 'body', transient: true })
    const { found, stopped } = depthFirst(resultsOf(s), expand, { depth, limit: LIMIT, most: 60, onStop, onCompare })
    // A search that has not stopped gives what it found so far (the first is enough to prove a goal), and says it goes
    // on: asking for every answer then never ends.
    const none = stopped ? T("搜了 {LIMIT} 步还没停下来：有一条路走不到头", {LIMIT})
      : depth < Infinity ? T("{depth} 层以内都搜遍了，也没有证完", {depth}) : T('都搜遍了，也没有证完')
    const out = asValue(found, { ...firstOf(s), error: none })
    return stopped ? { ...out, endless: true } : out
  },
}

/** Every goal: the region run on each goal of the state in turn, each on its own (Isabelle's ALLGOALS, Lean's <;>). */
const each = {
  inputs: ['in'],
  eval: ({ in: v }, node, ctx, key) => {
    traceFlow(ctx, node, key ?? null)
    if (key) return v
    const s = stateIn(v)
    if (s.error) return s
    const round = ctx.region('body')
    const put = (g, σ) => ({ ...g, hyps: g.hyps.map((h) => instantiate(h, σ ?? {})), goal: instantiate(g.goal, σ ?? {}) })
    // Partial results: the goals made so far, and what is known; each goal of the start is done on each of them.
    let partial = (ctx.backtrack ? resultsOf(s) : [firstOf(s)]).map((x) => ({ ...x, goals: [] }))
    let why = null
    for (const g of s.goals) {
      const next = []
      for (const p of partial) {
        const out = round({ ...p, goals: [put(g, p.inst)] })
        if (out.error) { why ??= out.error; continue }
        for (const r of ctx.backtrack ? resultsOf(out) : [firstOf(out)]) next.push({ ...r, more: undefined, goals: [...p.goals.map((x) => put(x, r.inst)), ...r.goals] })
      }
      if (!next.length) return { ...firstOf(s), error: why }
      partial = next.slice(0, 24)
    }
    return asValue(partial)
  },
}

// Each incoming wire is a candidate route. The junction preserves input order and leaves each candidate's goals
// and substitutions together. A later step can continue every candidate when backtracking is open.
const WAYS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']
const append = {
  circuitPart: (settingsOf) => ({ inputs: (node) => WAYS.slice(0, Number(settingsOf(node).ways)) }),
  run(values, { ways }, ctx) {
    traceFlow(ctx, ctx.node)
    const routes = values.slice(0, Number(ways)).flatMap((value, index) => value == null ? [] : [{ state: stateIn(value), route: index + 1 }])
    const open = routes.filter(({ state }) => !state.error)
    if (!open.length) return unsaid(routes[0].state)
    const results = ctx.backtrack ? open.flatMap(({ state }) => resultsOf(state)) : [firstOf(open[0].state)]
    return asValue(results.map(unsaid))
  },
}

// The machine board's parts, each as what it runs on: its inputs (a frame's own; repeat's region gives it its first
// round) and how it computes.
const forwardPart = part => ({
  ...part,
  eval(inputs, node, ctx, key) {
    traceFlow(ctx, node, key ?? null)
    return part.eval(inputs, node, ctx, key)
  },
})
const BODIES = {
  repeat,
  // Tactics (chapters 8 and 9).
  rule: ruleCard(rule, DID.rule),
  directBackward: directCard(rule, DID.rule),
  defer: tactic(defer, null, { work: false }),
  search,
  each,
  // Rewriting (chapter 10): one rule once, on the goal or the hypotheses.
  rw: usesRules((s, ctx, node, rules) => firstThatApplies(wired(rules, ctx.rewrites, NOT_REWRITE), ctx, (r) => rewriteAt(s, r, node)), DID.rw),
  directRewrite: directCard(rewriteAt, DID.rw),
  // Clauses (chapter 11, resolution.js): ∃ out of the hypotheses, a state split into clauses, a round of resolution,
  // someone else's prover, and the certificate replayed in the kernel.
  skolem: tactic(skolemStep),
  toClauses: { inputs: ['in'], eval: ({ in: v }) => toClauses(v) },
  resolve: { inputs: ['in'], eval: ({ in: v }, node) => { const c = clausesIn(v); return { ...c, set: resolveRound(c.set, { unit: node.params?.unit === 'unit' }) } } },
  oracle: forwardPart({ inputs: ['in'], eval: ({ in: v }, node, ctx) => saturated(clausesIn(v), node, ctx, oracleRound) }),
  replay: { inputs: ['in'], eval: ({ in: v }) => replayed(clausesIn(v)) },
  // A rule part: the rules wired in before it, then its own (machine.js ruleParts).
  rules: RULE_PART,
}
export const MACHINE_PARTS = { ...ruleImplementations(BODIES), append }

// The fixed things Skolem's ∃ out of a hypothesis may name, in order.
const FRESH = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'm', 'n']
const quantified = (f) => f.op === '∀' || f.op === '∃' || (f.op === '¬' ? quantified(f.a) : f.a ? quantified(f.a) || quantified(f.b) : false)
/**
 * Skolem: every ∃ in the first goal's hypotheses (in negation normal form) taken out; with none, the state as it is.
 * One under no ∀ is taken out as take the one there is does, its thing fixed (a name); one under a ∀ becomes a function of the
 * ∀'s variables (sk1(x) …), which does not follow from the hypotheses (the state is marked: replaying it would need the
 * axiom of choice).
 */
function skolemStep(s) {
  const g = s.goals[0]
  if (!g) return { fail: T('已经没有目标了') }
  const fixes = [...(g.fixes ?? [])]
  // Names already about: the fixed things and every name in the goal.
  const used = new Set([...fixes, ...[...JSON.stringify(g).matchAll(/"f":"([^"]+)"/g)].map((m) => m[1])])
  let n = 0
  let choice = false
  const go = (f, scope) => {
    if (f.op === '∃') {
      if (!scope.length) {
        const a = FRESH.find((x) => !used.has(x))
        used.add(a)
        fixes.push(a)
        return go(subst(f.body, f.v, fn(a)), scope)
      }
      choice = true
      return go(subst(f.body, f.v, fn(`sk${++n}`, scope.map(tvar))), scope)
    }
    if (f.op === '∀') return all(f.v, go(f.body, [...scope, f.v]))
    if (f.op === '∧' || f.op === '∨') return { ...f, a: go(f.a, scope), b: go(f.b, scope) }
    if (quantified(f)) throw fail('先把已知化成否定范式：¬ 和 → 挡住了量词', 'Bring the hypotheses to negation normal form first: ¬ and → stand in the quantifiers’ way')
    return f
  }
  const hyps = g.hyps.map((h) => go(h, []))
  return { results: [{ ...s, more: undefined, error: undefined, goals: [{ ...g, fixes, hyps }, ...s.goals.slice(1)], ...(choice || s.choice ? { choice: true } : {}) }] }
}
function toClauses(v) {
  const s = firstOf(stateIn(v))
  if (s.error) throw new OperationError(s.error)
  return clausesValue(clausesOfState(s, (t) => new OperationError(t)), { from: s })
}
// Rounds until ⊥ or nothing new (a traced run sees each round).
function saturated(c, node, ctx, round = resolveRound) {
  const r = saturate(c.set, { round, onRound: node ? (set, k) => inner(ctx, node, { ...c, set }, { round: k }) : null })
  return { ...c, set: r.set, ...(r.endless ? { endless: true } : {}) }
}
// The certificate replayed: the state it came from with its first goal proved, or with what the kernel would not take.
function replayed(c) {
  const r = replay(c)
  if (r.state) return r.state
  return { ...(c.from ?? { kind: 'state', goals: [] }), error: r.fail }
}
// The laws that bring hypotheses to conjunctive normal form, in order (those the level has).
const CNF_LAWS = ['iff.elim', 'arrow.elim', 'dneg.elim', 'dm.notOr', 'dm.notAnd', 'dm.notEx', 'dm.notAll', 'dist.orAndR', 'dist.orAndL']
/** Into clauses, as the player builds it: by contradiction, the hypotheses to CNF, ∃ out, split. */
function clausify(s0, ctx) {
  const step = (s, t) => {
    if (s.error) return s
    const r = t(firstOf(s))
    return r.fail ? { ...firstOf(s), error: r.fail } : r.results[0]
  }
  let s = step(step(s0, (x) => rule(x, KERNEL.raa)), (x) => rule(x, KERNEL.impI))
  const source = ctx.partForRule?.['logic/raa']
  const namespace = source?.slice(0, source.lastIndexOf('/') + 1) ?? ''
  s = step(s, (x) => simplify(x, CNF_LAWS.map((key) => ctx.rewrites?.[`${namespace}${key}`]).filter(Boolean), 'hyps'))
  s = step(s, skolemStep)
  if (s.error) throw new OperationError(s.error)
  return toClauses(s)
}

/** A test's inputs as values, by name. */
export function inputsOf(test, level) {
  // A level that builds a part taking rules gives them as an input of its own: the test's rules (`rules`, keys).
  const rules = test.rules ? { rules: rulesValue(test.rules.map((key) => rulePartsOf(level).get(rulePartOf(level, key).type).find((e) => e.key === key))) } : {}
  if (test.goal) return { in: startState(parseS(test.goal), (test.hyps ?? []).map(parseS)), ...rules }
  return { in: clausesValue(clauseSetOf(test.clauses)) }
}
const clauseSetOf = (texts) => [...new Map(texts.map((c) => parseClause(c, parseS)).map((c) => [c.key, c])).values()]
/** The names and labels of a level's inputs. */
export const inputsOfLevel = (level) => level.inputs ?? [{ name: 'in', label: catalogText("输入") }]

const RULE_PORT_APPEARANCE = { shape: 'compact', wire: 'dashed' }

/** A machine board: an `in` card for each of a level's inputs on the left, `out` on the right (it shows what is wanted). */
export const MACHINE_BOARD = circuitBoard({
  text: FORMULA_TEXT,
  portAppearance: (node, input, _output, task) => {
    if (input != null) return ['rules', 'before'].includes(input) ? RULE_PORT_APPEARANCE : undefined
    if (node.type === 'in' ? node.params?.name === 'rules' : rulePartsOf(task).has(node.type)) return RULE_PORT_APPEARANCE
  },
  cards: [
    { type: 'in', side: 'left', of: (task) => inputsOfLevel(task) },
    { type: 'out', side: 'right', of: () => [{ name: 'out', label: T("预期") }] },
  ],
  right: 900,
  gap: 130,
})
/** The board a machine level starts from: its inputs and its result. */
export const startMachine = (level) => MACHINE_BOARD.startBoard(level)

/* ---------- rule parts ---------- */

// A sentence in the level's words, in each language, for names made of it.
const inWords = (level, write) => ({ zh: write(f => say(f, level.notation).zh), en: write(f => say(f, level.notation).en) })
// A definition as the level writes it, in the level's words: 'c ⟹ l = r'.
function defText(d, text) {
  const [cond, eq] = d.includes('⟹') ? d.split('⟹') : [null, d]
  return `${cond ? `${cond.split(';').map((c) => text(parseS(c.trim()))).join('; ')} ⟹ ` : ''}${text(parseS(eq.trim()))}`
}
const MATH_NAME = T('数理规则书')
/** A rule part's name: the rule book of numbers, the proof-board part or lemma it is, or its rule's own name. */
function rulePartName(level, type, entries = rulePartsOf(level).get(type)) {
  if (type === MATH) return MATH_NAME
  const r = entries[0].rule
  if (r.fromHypothesis) return r.name
  if (r.part || level.lemmas?.[type]) return level.lemmas?.[type]?.name ?? level.partDefs?.[type]?.name ?? { zh: type, en: type }
  return r.group === 'def' ? inWords(level, (text) => defText(r.text, text)) : r.name
}
/** A rule of a rule part's, written out: an inference rule, or a rewrite rule (an equation given goes by its name). */
export const ruleWritten = (e, text, term) => stated(e.book === 'rule' ? ruleText(e.rule, text) : rewriteText(e.rule, text, term) || L(e.rule.name))
const AFTER = T('接入其他规则元件时，本元件的规则排在它们之后。')
const joined = (a, b) => T("{zh}{zh2}", {zh: { zh: String(a.zh), en: String(a.en) }, zh2: { zh: String(b.zh), en: String(b.en) }})
/** A rule part as every one is (machine.js RULE_PART): the rules wired in before it, then those added on it. */
export const RULE_DEFINITION = {
  name: T("规则元件"),
  desc: joined(T('给出这个元件的规则。在元件上添加要给出的规则，按添加顺序排列。'), AFTER),
  icon: 'GitFork',
  family: 'logic/rule',
  outputType: 'logic/machine-value',
  inputs: [{ name: 'before', type: 'logic/machine-value', label: T('前面'), optional: true }],
  settings: [{ key: 'use', control: 'list', formula: true, label: T("给出的规则"), from: 'logic/ruleChoices()' }],
  bare: true,
  op: 'logic/rules',
}
/**
 * The rule parts a level holds, as the course registers them beside parts.json's: one for each part its rule books'
 * rules belong to (rulePartsOf), named after it, giving the rules added on it.
 */
export function ruleParts(level) {
  return Object.fromEntries([...rulePartsOf(level).keys()].map((type) => {
    const several = choicesOfPart(rulePartsOf(level).get(type)).length > 1
    const desc = type === MATH ? joined(T('给出这一关的数与列表规则：类型声明生成的规则、定义中的等式和已证出的等式。在元件上添加要给出的规则，按添加顺序排列。'), AFTER)
      : type === ASSUMPTION_RULE.part ? joined(T('接给逆用规则。当前目标和一条已知对上时，这个目标就证完了。'), AFTER)
      : several ? RULE_DEFINITION.desc : joined(T('给出这个元件的规则。'), AFTER)
    // A part with one rule gives it, with nothing to add (ownRules): no setting to show.
    return [type, { ...RULE_DEFINITION, name: rulePartName(level, type), desc, ...(!several && { settings: [] }) }]
  }))
}

const directCards = new WeakMap()
const REWRITE_AT = {
  key: 'at',
  control: 'select',
  label: T('改写位置'),
  default: 'goal',
  options: [{ value: 'goal', label: T('目标') }, { value: 'hyps', label: T('已知') }],
}

// The proof operation owns its kernel rules; the part declaring that operation supplies them to its direct cards.
const KERNEL_BY_OPERATION = new Map()
for (const rule of Object.values(KERNEL)) {
  const operation = `logic/${rule.part}`
  if (!KERNEL_BY_OPERATION.has(operation)) KERNEL_BY_OPERATION.set(operation, [])
  KERNEL_BY_OPERATION.get(operation).push(rule)
}

/** The rules a source part supports, including the task's local sources. */
function rulesForSource(level, source, taskRewrites) {
  const holds = !level.holds || level.holds.includes(source)
  const operations = [...new Set(level.proofOperations?.[source] ?? [`logic/${source}`])]
  const kernel = holds ? operations.flatMap((operation) => KERNEL_BY_OPERATION.get(operation) ?? []) : []
  const assumption = holds && source === ASSUMPTION_RULE.part ? [ASSUMPTION_RULE] : []
  const lemma = holds && level.lemmas?.[source]
  const lemmaRulesHeld = lemma ? lemmaRules(source, lemma).filter((rule) =>
    !lemma.forms || !level.forms?.[source] || level.forms[source].includes(rule.key.split('.')[1] ?? lemma.forms[0].key)) : []
  const own = level.rules?.[source]
  const local = own ? [{ ...ruleOf(source, own.name, own.premises ?? [], own.conclusion), own: true }] : []
  const math = source === MATH
    ? [...datatypesRules(level.datatypes), ...factsOf(level).map(([type, fact]) => ({ ...ruleOf(type, fact.name, fact.rule?.premises ?? [], fact.rule?.conclusion ?? fact.statement), fact: true }))]
    : []
  const rewrites = [
    ...(lemma ? lemmaRewrites(source, lemma, level.forms?.[source]) : []),
    ...taskRewrites.filter((rule) => partOfRewrite(rule) === source),
  ]
  const entries = [
    ...[...assumption, ...kernel, ...lemmaRulesHeld, ...local, ...math].map((rule) => ({ key: rule.key, book: 'rule', rule })),
    ...rewrites.map((rule) => ({ key: rule.key, book: 'rewrite', rule })),
  ]
  return source === MATH ? entries.sort((a, b) => mathRank(a) - mathRank(b)) : entries
}

/** Project source parts into the operations they support on a proof state. */
export function directCardsOf(level) {
  if (!directCards.has(level)) {
    const cards = new Map()
    if (level.directRuleCards) {
      const sources = new Set([
        ...Object.keys(level.partDefs ?? {}), ...Object.keys(level.lemmas ?? {}), ...Object.keys(level.rules ?? {}),
        ...Object.values(KERNEL).map((rule) => level.ruleParts?.[`logic/${rule.part}`] ?? rule.part),
        ASSUMPTION_RULE.part, MATH, 'logic/hyp',
      ])
      const taskRewrites = localRewrites(level)
      for (const source of sources) {
        const rules = rulesForSource(level, source, taskRewrites)
        if (!rules.length) continue
        const name = rulePartName(level, source, rules)
        for (const [book, marker, op, desc] of [
          ['rule', 'backward', 'directBackward', T('逆用这张卡上的规则。')],
          ['rewrite', 'rewrite', 'directRewrite', T('用这张卡上的规则改写一处。')],
        ]) {
          const entries = rules.filter(entry => entry.book === book)
          if (!entries.length) continue
          const type = `logic/${op}-${source.replace('/', '_')}`
          const settings = [{ ...RULE_DEFINITION.settings[0], label: T('选择规则'), single: true }]
          if (book === 'rewrite') settings.push(REWRITE_AT)
          const sign = mark(marker)
          cards.set(type, { entries, source, definition: {
            name: { zh: `${sign} ${name.zh ?? name.en ?? name}`, en: `${sign} ${name.en ?? name.zh ?? name}` },
            desc, icon: level.partDefs?.[source]?.icon ?? 'Sigma', family: 'logic/tactic',
            inputs: [{ name: 'in', type: 'logic/machine-value' }],
            outputType: 'logic/machine-value', settings, op: `logic/${op}`,
          } })
        }
      }
    }
    directCards.set(level, cards)
  }
  return directCards.get(level)
}
/** The rules a rule part offers to add, each written out in the test's words (ctx: the task, its text, the card). */
export const RULE_CHOICES = {
  about: T("规则元件能给出的规则"),
  args: [],
  run: (_v, _n, ctx) => {
    const type = ctx.node?.type
    const entries = directCardsOf(ctx.task).get(type)?.entries ?? rulePartsOf(ctx.task).get(type) ?? []
    const choices = choicesOfPart(entries)
    const slots = ctx.ruleSlots ?? []
    const nodeId = ctx.node?.id
    return choices.map((key) => ({ value: key, mark: ruleMark(key, slots, nodeId), label: ruleWritten(entries.find((e) => e.key === key), ctx.text, ctx.term) }))
  },
}

/** A question's answers in a list of results: what its ?-letters become in each that has no goal left. */
export const answersIn = (out) => [...new Set(resultsOf(out).filter((s) => !s.error && !s.goals.length).map((s) => answerOf(s).map((side) => sideText(side)).join(', ')))].sort()

/** A goal written as a test writes it: '⋀a b. h1; h2 ⊢ goal', each part but the goal left out when empty. */
export function parseGoal(text) {
  const m = /^(?:⋀([a-z ]+)\.\s*)?(?:(.*)⊢\s*)?(.*)$/.exec(text.trim())
  return { fixes: m[1] ? m[1].trim().split(/\s+/) : [], hyps: m[2] ? m[2].split(';').map((h) => parseS(h)) : [], goal: parseS(m[3]) }
}
// A result's goals with its ?-letters named in the order they appear, so two results compare whatever names a step
// gave them.
const canonical = (goals) => {
  const names = new Map()
  return JSON.stringify(goals.map((g) => [g.fixes ?? [], g.hyps, g.goal])).replace(/"name":"(\?[^"]+)"/g, (_, n) => {
    if (!names.has(n)) names.set(n, `?${names.size}`)
    return `"name":"${names.get(n)}"`
  })
}

/** Is the output what the test wants? '' or why not. */
export function judge(want, test, out, level = {}) {
  const input = inputsOf(test, level).in
  if (!out) return T('还没有东西接到「结果」')
  if (want === 'logic/proved') {
    if (out.kind !== 'state') return T('结果要一个证明状态')
    if (out.error) return out.error
    return out.goals.length ? T("还剩 {length} 个目标没证完", {length: out.goals.length, value: out.goals.length === 1 ? '' : 's'}) : ''
  }
  if (want === 'logic/becomes') {
    if (out.kind !== 'state') return T('结果要一个证明状态')
    if (!test.becomes.length) return out.error ? '' : T('这一步应该做不了，证明器却做了')
    if (out.error) return out.error
    const got = resultsOf(out).map((r) => canonical(r.goals))
    const wanted = test.becomes.map((r) => canonical(r.map(parseGoal)))
    if (got.length !== wanted.length) return T("要 {length} 种结果，得到 {length2} 种", {length: wanted.length, length2: got.length, value: wanted.length === 1 ? '' : 's'})
    const k = got.findIndex((g, i) => g !== wanted[i])
    return k < 0 ? '' : (wanted.length > 1 ? T('第 {n} 种结果的目标和要的不一样', { n: k + 1 }) : T('得到的目标和要的不一样'))
  }
  if (want === 'logic/fails') {
    if (out.kind !== 'state') return T('结果要一个证明状态')
    if (out.endless) return out.error ?? T('搜索停不下来')
    if (!out.error) return out.goals.length ? T('这一句证不出来，证明器却还没有说「证不出来」') : T('这一句不该证得出来')
    return ''
  }
  if (want === 'logic/answers') {
    if (out.kind !== 'state') return T('结果要一个证明状态')
    if (out.endless) return T('要找出所有答案，可搜索停不下来：有一条路走不到头')
    if (out.error) return out.error
    const got = answersIn(out)
    const wanted = [...new Set(test.answers)].sort()
    if (got.join(';') === wanted.join(';')) return ''
    const list = (xs) => (xs.length ? xs.join('、') : '没有')
    const listEn = (xs) => (xs.length ? xs.join(', ') : 'none')
    return T("找到的答案是 {value}，应该是 {value2}", {value: { zh: String(list(got)), en: String(listEn(got)) }, value2: { zh: String(list(wanted)), en: String(listEn(wanted)) }})
  }
  if (out.kind !== 'clauses') return T('结果要一组子句')
  if (want === 'logic/clauses') {
    const wanted = clauseSetOf(test.clauses).map((c) => c.key).sort()
    const got = out.set.map((c) => c.key).sort()
    return wanted.join(';') === got.join(';') ? '' : T('拆出的子句和要的不一样')
  }
  const has = refuted(out.set)
  if (want === 'logic/refuted') {
    if (!has) return T('结果里还没有空子句 ⊥')
    return test.budget && out.set.length > test.budget ? T("推出 ⊥ 用了 {length} 条子句，最多只能有 {budget} 条", {length: out.set.length, budget: test.budget}) : ''
  }
  // decide: ⊥ when the clauses cannot all hold; when they can, saturated without it.
  const start = input.kind === 'clauses' ? input.set : clausify(input, ctxOf(level, { nodes: [], wires: [] })).set
  const unsat = refuted(saturate(start).set)
  if (unsat) return has ? '' : T('结果里还没有空子句 ⊥')
  if (has) return T('结果里有 ⊥，可这组子句是可满足的：证明器「证」出了假话')
  if (out.endless) return T('一直推出新子句，停不下来')
  return resolveRound(out.set).length === out.set.length ? '' : T('结果还能再归结出新子句：还没饱和')
}

const merged = (a = new Map(), b = new Map()) => new Map([...a, ...b])
/** A packed machine part reads the work and rules of its selected builder; `params` the settings its part takes beyond
 *  its board's (simp works on the goal or the hypotheses). */
export function builtMachine(type, builder, reference, ownBoard, params = []) {
  const circuit = () => ownBoard(builder().taskId) ?? builder().partSolution
  const part = packed({
    circuit,
    inputs: inputsOfLevel(reference).map((i) => i.name),
    outputs: ['out'],
    inside: (ctx) => {
      const b = builder()
      return { ...ctx, rules: { ...ruleBookOf(b), ...ctx.rules }, rewrites: { ...rewriteBookOf(b), ...ctx.rewrites }, ruleParts: merged(rulePartsOf(b), ctx.ruleParts), directCards: merged(directCardsOf(b), ctx.directCards), backtrack: ctx.backtrack || Boolean(b.backtrack) }
    },
  })
  return {
    ...part,
    inputTypes: Object.fromEntries(part.inputs.map((name) => [name, 'logic/machine-value'])),
    outputType: 'logic/machine-value',
    built: true,
    params,
    eval: failsAsState(part.eval),
    opens: () => ({ circuit: circuit(), level: builder() }),
  }
}
// A tactic that cannot go on gives the state it was handed with what went wrong, as every tactic does (a frame reads
// it), and a state that failed already passes through.
const failsAsState = (run) => (ins, node, ctx) => {
  if (ins.in?.kind === 'state' && ins.in.error) return ins.in
  try {
    return run(ins, node, ctx)
  } catch (e) {
    if (e instanceof OperationError && ins.in?.kind === 'state') return { ...firstOf(ins.in), error: e.label }
    throw e
  }
}

// What a machine runs with: the level's books and rule parts, whether it backtracks, and the board input that is a
// constant (a level's rules, for a frame's region: ../../circuit/frames.js runRegion).
const ctxOf = (level, circuit, extra = {}) => ({ graph: circuit, partForRule: level.ruleParts, rules: ruleBookOf(level), rewrites: rewriteBookOf(level), ruleParts: rulePartsOf(level), directCards: directCardsOf(level), backtrack: Boolean(level.backtrack), constants: ['rules'], ...extra })

/** A machine part run on a proof state with a level's rule and rewrite books (chapter 15: a script's by), the rules
 *  `keys` wired in when it uses rules. */
export const runTactic = (level, type, state, keys = null) => level.parts(type).eval({ in: state, ...(keys ? { rules: rulesValue(keys.map((key) => ({ key }))) } : {}) }, { id: type, params: {} }, ctxOf(level, { nodes: [], wires: [] }, { engine: { parts: level.parts } }))

export const subscript = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d])
export const slotMark = (index, count) => count > 1 && index >= 0 ? `R${subscript(index + 1)}` : 'R'
export function ruleMark(key, slots, nodeId) {
  const own = nodeId === undefined ? -1 : slots.findIndex((slot) => slot.nodeId === nodeId)
  const shared = own >= 0 ? own : slots.findIndex((slot) => slot.nodeId === undefined && slot.entry?.key === key)
  const index = shared >= 0 ? shared : slots.findIndex((slot) => slot.entry?.key === key)
  return slotMark(index, slots.length)
}

/** A direct card reserves one rule number. Shared rules are numbered once per selected key. */
export function boardRules(level, circuit, test) {
  const parts = rulePartsOf(level)
  const directCards = directCardsOf(level)
  const slots = []
  const shared = new Set()
  const addShared = (entry) => {
    if (shared.has(entry.key)) return
    shared.add(entry.key)
    slots.push({ entry })
  }
  if (test) (inputsOf(test, level).rules?.entries ?? []).forEach(addShared)
  for (const node of circuit.nodes) {
    const direct = directCards.get(node.type)
    const entries = direct?.entries ?? parts.get(node.type)
    if (!entries) continue
    const selected = ownRules(entries, node.params?.use)
    if (direct) {
      slots.push({ nodeId: node.id, entry: entries.find((e) => e.key === selected[0]) })
    } else {
      selected.forEach((key) => addShared(entries.find((e) => e.key === key)))
    }
  }
  return slots
}

/** How a machine level runs and is judged, for the shared engine (../../engine/test-run.js). */
export const MACHINE_TESTS = {
  runTest: (level, circuit, test, { traced = false, workshopParts } = {}) => {
    const trace = []
    const bind = inputsOf(test, level)
    const want = test.want ?? level.want
    const proof = traced && bind.in?.kind === 'state' ? traceProof(bind.in) : null
    const showTree = ['logic/proved', 'logic/becomes', 'logic/answers', 'logic/fails'].includes(want)
    if (proof) bind.in = proof.input
    const run = runBoard(circuit, {
      parts: workshopParts ?? level.parts,
      bind,
      ctx: ctxOf(level, circuit, { trace: traced ? trace : null, traceForwarding: traced, proof }),
      traceTargets: ['out'],
    })
    const ruleSlots = boardRules(level, circuit, test)
    for (const entry of trace.flatMap(step => step.proofRules ?? [])) {
      if (!ruleSlots.some(slot => slot.entry?.key === entry.key)) ruleSlots.push({ entry })
    }
    const events = machineEvents(trace)
    const report = proof
      ? finishProof(proof, events, run.outputs.out, want, showTree ? judge(want, test, run.outputs.out, level) : '')
      : { trace: countMachineSteps(events) }
    if (!showTree) delete report.proofRoot
    return { ...run, ...report, ruleSlots }
  },
  check: (level, test, outputs) => {
    const problem = judge(test.want ?? level.want, test, outputs.out, level)
    return [{ name: 'out', pass: !problem, reason: problem }]
  },
  // Rule parts are what the cards read, not steps of the machine.
  score: (level, circuit, _runs, options) => {
    const rules = rulePartsOf(level)
    const nodes = options?.workshopParts ? workNodes(circuit, options.workshopParts).map(({ node }) => node) : circuit.nodes
    return { steps: nodes.filter((n) => n.type !== 'in' && n.type !== 'out' && !rules.has(n.type)).length }
  },
}

/** Use the same case checks and card budget in play and authoring. */
export function runMachine(level, board, options) {
  const constraint = ({ steps }) => level.budget !== undefined && steps > level.budget
    ? T("所有测试都正确，但用了 {steps} 张卡，这一关最多允许 {budget} 张。", {steps, budget: level.budget})
    : ''
  return runOutputTests(MACHINE_TESTS, { ...level, constraint }, board, options)
}
