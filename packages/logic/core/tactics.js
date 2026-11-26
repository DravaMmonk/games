// Proof states and tactics (《证明完毕》 chapters 8 and 9). A proof state is the goals still open, each with the things
// it has fixed and the hypotheses it may use; metavariables a rule left in them are shared by every goal, and filled in
// wherever one is unified (Isabelle's ?A, Lean's ?m). A tactic takes a state to the states it can make of it: none
// (it fails, and says why), one, or several (one for each way it applies, tried in order). The rules act on goals
// backwards or read givens forwards.
//
//   state  { kind: 'state', goals: [goal], scopes: { ?name: [fixed] }, inst: σ, fixed: [name], query: [?name],
//            error?: { zh, en }, more?: [state], endless? }
//   goal   { fixes: [name], hyps: [formula], goal: formula }
//
// `scopes` says which fixed things each metavariable may become (those fixed when it was left), `inst` what the
// metavariables have become so far, `query` the metavariables of the start (a question: who is a grandparent?), and
// `more` the further results after this one, when a tactic gives several, and `endless` that a search making them did
// not stop (schematic.js does the unifying).
import { fn, matchThings, same, subst, tvar } from './formula.js'
import { KERNEL_RULES, instantiate, metasIn, namesIn, unify } from './schematic.js'
import { T } from 'kernel/words'

const NO_GOALS = T('已经没有目标了')
// The names a fixed thing gets, in order.
const FIXED = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'm', 'n']

export const stateValue = (goals, error = null) => ({ kind: 'state', goals, ...(error ? { error } : {}) })
/** A state's start: one goal with its hypotheses; its metavariables (a question's) may become anything. */
export function startState(goal, hyps = []) {
  const query = [...metasIn(goal)]
  return { kind: 'state', goals: [{ fixes: [], hyps, goal }], scopes: Object.fromEntries(query.map((m) => [m, []])), inst: {}, fixed: [], query }
}
/** A state's results as a list: itself and the ones after it. */
export const resultsOf = (s) => [{ ...s, more: undefined, endless: undefined }, ...(s.more ?? [])]
/** A list of results as one value: the first, carrying the rest; the first failure when there is none. */
export const asValue = (list, failed) => (list.length ? (list.length > 1 ? { ...list[0], more: list.slice(1) } : list[0]) : failed)
/** What the start's metavariables have become in a state (a question's answer). */
export const answerOf = (s) => (s.query ?? []).map((m) => instantiate(/^\?[A-Z]/.test(m) ? { op: 'meta', name: m } : { t: 'var', name: m }, s.inst ?? {}))

const fixesOf = (g) => g.fixes ?? []
// The ?-letters a state knows: those in its goals, those it scopes, and those already settled (a new one may not reuse
// a settled name).
function metasOfState(s) {
  const out = new Set([...Object.keys(s.scopes ?? {}), ...Object.keys(s.inst ?? {})])
  for (const g of s.goals) [g.goal, ...g.hyps].forEach((f) => metasIn(f, out))
  return out
}
// The rule with its metavariables renamed apart from the state's: ?A, then ?A1, ?A2 …
function renamed(rule, used) {
  const own = new Set()
  for (const f of [rule.conclusion, ...rule.premises.flatMap((p) => [p.show, ...p.hyps])]) metasIn(f, own)
  const names = {}
  for (const m of own) {
    let name = m
    for (let k = 1; used.has(name); k++) name = `${m}${k}`
    used.add(name)
    names[m] = name
  }
  const ren = (f) => renameMetas(f, names)
  return { ...rule, conclusion: ren(rule.conclusion), premises: rule.premises.map((p) => ({ ...p, show: ren(p.show), hyps: p.hyps.map(ren) })), metas: Object.values(names) }
}
// A formula (or term) with its metavariables renamed, applied ones keeping what they are applied to.
function renameMetas(x, names, witnesses) {
  const rename = side => renameMetas(side, names, witnesses)
  if ('t' in x) {
    if (x.t === 'var') return names[x.name] ? { ...x, name: names[x.name] } : x
    if (!x.args.length && witnesses?.has(x.f)) return tvar(witnesses.get(x.f))
    return { ...x, args: x.args.map(rename) }
  }
  switch (x.op) {
    case 'meta': return { ...x, name: names[x.name] ?? x.name, ...(x.args ? { args: x.args.map(rename) } : {}) }
    case 'atom': return { ...x, args: x.args.map(rename) }
    case '¬': return { ...x, a: rename(x.a) }
    case '∀': case '∃': return { ...x, body: rename(x.body) }
    case '⊥': return x
    default: return { ...x, a: rename(x.a), b: rename(x.b) }
  }
}

// The goals a rule's premises make of goal g: each with g's fixed things and hypotheses, its own assumptions, and a new
// fixed thing for each of its ⋀ variables.
function lift(premises, g, s, conclusion) {
  const taken = new Set([...(s.fixed ?? []), ...fixesOf(g)])
  if (premises.some(p => p.fixes.length)) {
    const formulas = [conclusion, ...Object.values(s.inst ?? {}), ...s.goals.flatMap(({ goal, hyps }) => [goal, ...hyps]),
      ...premises.flatMap(p => [p.show, ...p.hyps])]
    for (const f of formulas) namesIn(f, taken)
  }
  const fixed = []
  const goals = premises.map((p) => {
    const names = p.fixes.map(() => {
      let n = FIXED.find(x => !taken.has(x))
      if (!n) {
        let index = 1
        while (taken.has(`a${index}`)) index++
        n = `a${index}`
      }
      taken.add(n)
      fixed.push(n)
      return n
    })
    const put = (f) => p.fixes.reduce((h, v, k) => subst(h, v, fn(names[k])), f)
    return { fixes: [...fixesOf(g), ...names], hyps: [...g.hyps, ...p.hyps.map(put)], goal: put(p.show) }
  })
  return { goals, fixed }
}
const keyOf = (f) => JSON.stringify(f)
const unique = (fs) => [...new Map(fs.map((f) => [keyOf(f), f])).values()]
const forwardMetas = Symbol('forward metavariables')
const isSentenceMeta = name => /^\?[A-Z]/.test(name)
export const hasUnresolvedSentence = (s, formula) => [...metasIn(formula)]
  .some(name => isSentenceMeta(name) && !s[forwardMetas]?.has(name))
// The state after a step: the new goals in front of the rest, everything with σ put in; a hypothesis already there is
// not kept twice.
function after(s, σ, goals, scopes, fixed = []) {
  const put = (f) => instantiate(f, σ)
  return {
    kind: 'state',
    goals: goals.map((g) => ({ fixes: fixesOf(g), hyps: unique(g.hyps.map(put)), goal: put(g.goal) })),
    scopes,
    inst: σ,
    fixed: [...(s.fixed ?? []), ...fixed],
    query: s.query ?? [],
    ...(s[forwardMetas] && { [forwardMetas]: s[forwardMetas] }),
  }
}

/* ---------- tactics: state → { results: [state] } | { fail } ---------- */

/** Unify the chosen goal with the rule's conclusion and replace it in place by its premises. */
export function rule(s, R, index = 0) {
  if (R.fromHypothesis) return assumption(s, index)
  const g = s.goals[index]
  if (!g) return { fail: NO_GOALS }
  const r = renamed(R, metasOfState(s))
  const scopes = { ...s.scopes, ...Object.fromEntries(r.metas.map((m) => [m, fixesOf(g)])) }
  const u = unify([[r.conclusion, g.goal]], s.inst ?? {}, { scopes, fixed: s.fixed ?? [] })
  if (u.fail) return { fail: T('「{rule}」的结论对不上第 {index} 个目标：{reason}', { rule: R.name, index: index + 1, reason: u.fail }) }
  const { goals, fixed } = lift(r.premises, g, s, r.conclusion)
  return { results: [after(s, u.σ, [...s.goals.slice(0, index), ...goals, ...s.goals.slice(index + 1)], scopes, fixed)] }
}

const isPlain = ({ fixes, hyps }) => !fixes.length && !hyps.length
export const canReadGivens = rule => rule.premises?.some(isPlain) ?? false
const canonicalNames = formulas => Object.fromEntries(
  [...formulas.reduce((found, formula) => metasIn(formula, found), new Set())].map((name, index) => [name, `?${index}`]))
const canonicalMetas = (formula, witnesses) => renameMetas(formula, canonicalNames([formula]), witnesses)

// Preserve shared schematic variables across the whole rule when comparing forms.
function canonicalRule({ premises, conclusion }) {
  const ordered = [...premises.filter(isPlain), ...premises.filter(p => !isPlain(p))]
  const names = canonicalNames([...ordered.flatMap(p => [p.show, ...p.hyps]), conclusion])
  const rename = formula => renameMetas(formula, names)
  return { conclusion: rename(conclusion), premises: ordered.map(p => ({ ...p, show: rename(p.show), hyps: p.hyps.map(rename) })) }
}

export function uniqueForwardRules(entries) {
  const seen = []
  return entries.filter(({ rule }) => {
    const { premises, conclusion } = canonicalRule(rule)
    if (seen.some(other => premises.length === other.premises.length && same(conclusion, other.conclusion)
      && premises.every((p, index) => {
        const q = other.premises[index]
        if (p.fixes.length !== q.fixes.length || p.hyps.length !== q.hyps.length) return false
        const binders = p.fixes.map((name, i) => [name, q.fixes[i]])
        return same(p.show, q.show, binders) && p.hyps.every((hyp, i) => same(hyp, q.hyps[i], binders))
      }))) return false
    seen.push({ premises, conclusion })
    return true
  })
}

// Only names introduced by this step can stand for a different witness. Each such
// name must stand for the same individual at all its occurrences in the sentence.
function isNewGiven(formula, old, fixed) {
  if (!fixed.length) {
    const normalized = canonicalMetas(formula)
    return !old.some(hyp => same(normalized, hyp))
  }
  const witnesses = new Map(fixed.map((name, index) => [name, `?witness${index}`]))
  const pattern = canonicalMetas(formula, witnesses)
  return !old.some(hyp => {
    const bindings = matchThings(pattern, hyp, witnesses.values())
    return bindings && [...bindings.values()].every(term => term.t === 'fn' && !term.args.length)
  })
}

/** Match every unboxed premise against the first goal's givens, in input order. */
export function forward(s, R, { at, first = false } = {}) {
  const g = s.goals[0]
  if (!g || !canReadGivens(R)) return { matches: [], reason: 'rule-mismatch' }
  const r = renamed(R, metasOfState(s))
  const plain = r.premises.filter(isPlain)
  const boxed = r.premises.filter(p => !isPlain(p))
  const { conclusion } = r
  const eliminate = conclusion.op === 'meta' && !conclusion.args?.length
    && !plain.some(p => metasIn(p.show).has(conclusion.name))
  const scopes = { ...s.scopes, ...Object.fromEntries(r.metas.map(m => [m, fixesOf(g)])) }
  const opts = { scopes, fixed: s.fixed ?? [] }
  const pairs = eliminate ? [[conclusion, g.goal]] : []
  const { goals, fixed } = lift(boxed, g, s, conclusion)
  const matches = []
  let matched = false
  const visit = (indices, equations) => {
    if (indices.length < plain.length) {
      return g.hyps.some((hyp, index) => {
        if (!indices.length && at && at !== `hyp-${index}`) return false
        return visit([...indices, index], [...equations, [plain[indices.length].show, hyp]])
      })
    }
    // Solve all premises together so a later one can determine an earlier pattern.
    const u = unify(equations, s.inst ?? {}, opts)
    if (u.fail) return false
    matched = true
    const put = formula => instantiate(formula, u.σ)
    const existing = g.hyps.map(hyp => canonicalMetas(put(hyp)))
    const continuation = { ...g, hyps: [...g.hyps, conclusion] }
    const head = eliminate ? goals : [...goals, continuation]
    const addedHyps = head.flatMap((goal, goalIndex) => {
      const added = goal.hyps.slice(g.hyps.length).map(put)
        .filter(hyp => isNewGiven(hyp, existing, fixesOf(goal).slice(fixesOf(g).length)))
      return added.length ? [{ goalIndex, hyps: unique(added) }] : []
    })
    if (eliminate) {
      // An unchanged branch would still ask for the original proof with the same givens.
      if (goals.some((goal, index) => same(put(goal.goal), put(g.goal))
        && !addedHyps.some(added => added.goalIndex === index))) return false
    } else if (!addedHyps.some(added => added.goalIndex === boxed.length)) return false
    const state = after(s, u.σ, [...head, ...s.goals.slice(1)], scopes, fixed)
    // N1 still rejects sentence holes left by backward applications. Forward
    // schematics stand in derived givens or scoped obligations and may be read later.
    const own = r.metas.filter(name => isSentenceMeta(name) && !u.σ[name])
    if (own.length) state[forwardMetas] = new Set([...(s[forwardMetas] ?? []), ...own])
    matches.push({ state, indices, addedHyps })
    return first
  }
  visit([], pairs)
  return { matches, reason: matches.length ? null : at ? 'position-missing' : matched ? 'nothing-new' : 'rule-mismatch' }
}

/** Unify the chosen goal with one of its hypotheses (each that fits is a result). */
export function assumption(s, index = 0) {
  const g = s.goals[index]
  if (!g) return { fail: NO_GOALS }
  const results = []
  const why = []
  for (const h of g.hyps) {
    const u = unify([[g.goal, h]], s.inst ?? {}, { scopes: s.scopes ?? {}, fixed: s.fixed ?? [] })
    if (u.fail) { why.push(u.fail); continue }
    results.push(after(s, u.σ, s.goals.slice(0, index).concat(s.goals.slice(index + 1)), s.scopes ?? {}))
  }
  if (results.length) return { results }
  return { fail: late(why) ?? T('第 {index} 个目标和哪一条已知都对不上', { index: index + 1 }) }
}

// Of the reasons unifying failed, the one worth saying: a metavariable that may not become a thing fixed after it.
const late = (why) => why.find((w) => /之前留下|was left before/.test(w.en)) ?? null

// A hypothesis written out with its ?-letters named in the order they appear: Human(?t1) → Animal(?t1) is the same
// hypothesis as Human(?t) → Animal(?t), so taking one again with a new ?-letter is nothing new. (Goals keep their
// letters: a goal asking the same of a new ?-letter, as a rule calling itself does, may well be progress.)
const shapeOf = (f) => {
  const names = new Map()
  return keyOf(f).replace(/"name":"(\?[^"]+)"/g, (_, n) => {
    if (!names.has(n)) names.set(n, `?${names.size}`)
    return `"name":"${names.get(n)}"`
  })
}
// A state's goals by their sentence, each with its hypotheses written out (kept, as a search compares a state with
// every one on its path).
const indexed = new WeakMap()
function goalsBy(s) {
  if (!indexed.has(s)) {
    const by = new Map()
    for (const g of s.goals) {
      const k = keyOf(g.goal)
      if (!by.has(k)) by.set(k, [])
      by.get(k).push({ fixes: fixesOf(g), hyps: g.hyps.map(shapeOf) })
    }
    indexed.set(s, by)
  }
  return indexed.get(s)
}
// Is a goal (g2) no easier than another with the same sentence (g): each hypothesis of g2 one of g's, once each thing
// g2 fixed beyond g's is named as one of g's (taking a thing out again gives nothing new).
function noEasier(g2, g) {
  const have = new Set(g.hyps)
  const extra = g2.fixes.filter((x) => !g.fixes.includes(x))
  const namings = extra.reduce((list, x) => list.flatMap((m) => g.fixes.map((y) => [...m, [keyOf(fn(x)), keyOf(fn(y))]])), [[]])
  return namings.some((m) => g2.hyps.every((h) => have.has(m.reduce((k, [x, y]) => k.split(x).join(y), h))))
}
/**
 * A state that is no nearer the end than one before it: it has as many goals at least, and each goal of that one has
 * a goal here no easier than it.
 */
export function noProgress(next, before) {
  if (next.goals.length < before.goals.length) return false
  const there = goalsBy(next)
  for (const [k, goals] of goalsBy(before)) {
    const same = there.get(k)
    if (!same || !goals.every((g) => same.some((g2) => noEasier(g2, g)))) return false
  }
  return true
}

/**
 * Depth first: the results of `expand` on each state, deeper and deeper, every state with no goal left found, in
 * order; a path stops at `depth` steps (when given), and is not followed into a state no nearer the end than one
 * already on it. { found, stopped }: stopped when it went on for `limit` steps.
 */
export function depthFirst(starts, expand, { depth = Infinity, limit = 600, most = 12, onStop, onCompare } = {}) {
  const found = []
  let steps = 0
  let stopped = false
  const go = (s, d, path) => {
    if (found.length >= most || stopped) return onStop?.(s, 'limit')
    if (!s.goals.length) { found.push(s); return }
    if (d >= depth) return onStop?.(s, 'depth')
    if (++steps > limit) { stopped = true; return onStop?.(s, 'limit') }
    const on = [s, ...path]
    for (const next of expand(s)) {
      if (!next.goals.length) { go(next, d + 1, on); continue }
      const pruned = on.some(b => noProgress(next, b))
      const checked = onCompare ? onCompare(next, pruned) : next
      if (pruned) onStop?.(checked, 'noProgress')
      else go(checked, d + 1, on)
    }
  }
  for (const s of starts) go(s, 0, [])
  return { found, stopped }
}

/** The kernel's rules by key. */
export const KERNEL = Object.fromEntries(KERNEL_RULES.map((r) => [r.key, r]))
