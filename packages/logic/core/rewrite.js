// Rewriting (《证明完毕》 chapter 10 on): a rewrite rule replaces what fits its left side by its right side, in the first
// goal of a proof state (tactics.js), at the first place it fits: outermost first, then left to right, under
// quantifiers too. A rule is an equivalence of sentences or an equation of things, its ?-letters filled in by
// matching; one with conditions leaves each condition, filled in, as a goal after the rewritten one.
//
//   rule  { key, name, lhs, rhs, conditions: [formula], group: 'law' | 'def' | 'hyp' }
//
// Where rules come from (rewriteBookOf): a lemma's two shapes that are each other's converse (¬¬A gives A and A gives
// ¬¬A: either way round is a rule), the equations proved (the course's `facts`, chapter 12), the level's definitions (`defs`: equations, maybe with conditions, their
// variables standing for anything), and the goal's own hypotheses (the card's rule 'hyp': the first hypothesis that is
// an equation or an equivalence and fits somewhere, its ∀ variables standing for anything).
import { atom, bin, fn, occurrenceScope, same, show, showTerm, subst, tvar } from './formula.js'
import { inferenceText, instantiate, isMetaName, lemmaRules, metasIn, parseS, sameSide, sideText } from './schematic.js'
import { T } from 'kernel/words'

const isTerm = (x) => 't' in x
const NO_GOALS = T('已经没有目标了')
export const equivalenceSubstitution = (reverse) => inferenceText(['A ↔ B', reverse ? 'C[B]' : 'C[A]'], reverse ? 'C[A]' : 'C[B]')
export const equalitySubstitution = inferenceText(['s = t', 'C[s]'], 'C[t]')

/* ---------- matching ---------- */

// The free variables of a formula or term.
function freeIn(x, out = new Set(), bound = new Set()) {
  if (isTerm(x)) {
    if (x.t === 'var') { if (!bound.has(x.name)) out.add(x.name) } else x.args.forEach((a) => freeIn(a, out, bound))
    return out
  }
  switch (x.op) {
    case 'meta': case 'atom': (x.args ?? []).forEach((a) => freeIn(a, out, bound)); break
    case '¬': freeIn(x.a, out, bound); break
    case '∀': case '∃': freeIn(x.body, out, new Set([...bound, x.v])); break
    case '⊥': break
    default: freeIn(x.a, out, bound); freeIn(x.b, out, bound)
  }
  return out
}
function bind(σ, name, value) {
  const had = σ[name]
  if (!had) { σ[name] = value; return true }
  return sameSide(had, value)
}
// The pattern p (a rule's side, with ?-letters) fitted to x, filling σ. `env` pairs the pattern's bound variables with
// x's, `inside` the variables bound inside the pattern around x (a ?-letter applied to bound variables, ?P(x), may
// take those it is applied to, and none other bound inside the pattern; what is bound around the whole place is in
// scope wherever the result goes).
function matchTerm(p, x, σ, env) {
  if (p.t === 'var') {
    if (isMetaName(p.name)) return bind(σ, p.name, x)
    return x.t === 'var' && (env.get(p.name) ?? p.name) === x.name
  }
  return x.t === 'fn' && p.f === x.f && p.args.length === x.args.length && p.args.every((a, k) => matchTerm(a, x.args[k], σ, env))
}
function matchForm(p, x, σ, env, inside, names = {}) {
  if (p.op === 'meta') {
    if (!p.args?.length) return bind(σ, p.name, x)
    const params = p.args.map((a) => (a.t === 'var' ? env.get(a.name) : null))
    if (params.some((v) => !v)) return false
    if ([...freeIn(x)].some((v) => inside.has(v) && !params.includes(v))) return false
    return bind(σ, p.name, { op: 'lam', params, body: x })
  }
  if (p.op !== x.op) return false
  switch (p.op) {
    case 'atom': return p.pred === x.pred && p.args.length === x.args.length && p.args.every((a, k) => matchTerm(a, x.args[k], σ, env))
    case '⊥': return true
    case '¬': return matchForm(p.a, x.a, σ, env, inside, names)
    case '∀': case '∃':
      names[p.v] = x.v
      return matchForm(p.body, x.body, σ, new Map([...env, [p.v, x.v]]), new Set([...inside, x.v]), names)
    default: return matchForm(p.a, x.a, σ, env, inside, names) && matchForm(p.b, x.b, σ, env, inside, names)
  }
}

/* ---------- one rewrite ---------- */

// A rule's side with its bound variables named as the place it fitted named them (`names`), so what is put in for its
// ?-letters is never caught by them: ¬∃y. P(y, x) ⟼ ∀y. ¬P(y, x), not ∀x. ¬P(x, x).
function renamed(f, names) {
  const term = (t, map) => (t.t === 'var' ? (map[t.name] ? tvar(map[t.name]) : t) : fn(t.f, t.args.map((a) => term(a, map))))
  const go = (g, map) => {
    switch (g.op) {
      case 'atom': return atom(g.pred, g.args.map((a) => term(a, map)))
      case 'meta': return g.args ? { ...g, args: g.args.map((a) => term(a, map)) } : g
      case '¬': return { op: '¬', a: go(g.a, map) }
      case '∀': case '∃': { const v = names[g.v] ?? g.v; return { op: g.op, v, body: go(g.body, { ...map, [g.v]: v }) } }
      case '⊥': return g
      default: return bin(g.op, go(g.a, map), go(g.b, map))
    }
  }
  return go(f, {})
}

// The same traversal supplies the editor and the tactic. Paths identify repeated nodes even when they share an object.
function* rewriteMatches(formula, rule) {
  const exact = rule.equivalenceOnly
  const term = isTerm(rule.lhs)
  const blocks = exact ? occurrenceScope(rule.lhs, rule.rhs) : () => false
  function* walk(node, path, depth) {
    const σ = {}
    const names = {}
    const matches = isTerm(node) === term && (exact ? same(node, rule.lhs) : term
      ? matchTerm(rule.lhs, node, σ, new Map())
      : matchForm(rule.lhs, node, σ, new Map(), new Set(), names))
    if (matches) {
      const replacement = exact ? rule.rhs : instantiate(term ? rule.rhs : renamed(rule.rhs, names), σ)
      yield { path, depth, replacement, σ }
      if (exact) return
      depth++
    }
    if (blocks(node)) return
    if (!term && node.op === 'atom') return
    for (const key of ['a', 'b', 'body']) {
      if (node[key]) yield* walk(node[key], [...path, key], depth)
    }
    if (term) {
      for (const [index, arg] of (node.args ?? []).entries()) {
        yield* walk(arg, [...path, 'args', index], depth)
      }
    }
  }
  yield* walk(formula, [], 0)
}

const atPath = (node, path) => path.reduce((value, key) => value[key], node)
function replaceAt(node, [key, ...rest], value) {
  if (key === undefined) return value
  if (Array.isArray(node)) return node.map((item, index) => index === key ? replaceAt(item, rest, value) : item)
  return { ...node, [key]: replaceAt(node[key], rest, value) }
}

// A hypothesis as a rule, its ∀ variables standing for anything: an equation of things, or an
// equivalence. A hypothesis that still has a ?-letter of the proof in it is not one yet.
function hypRule(h) {
  if (metasIn(h).size) return null
  let f = h
  const vars = []
  while (f.op === '∀') { vars.push(f.v); f = f.body }
  const free = (x) => vars.reduce((g, v) => subst(g, v, tvar(`?${v}`)), x)
  if (f.op === 'atom' && f.pred === '=') {
    const [l, r] = free(f).args
    return { lhs: l, rhs: r }
  }
  if (f.op === '↔') return { lhs: free(f.a), rhs: free(f.b) }
  return null
}

// An equation proved as a rewrite rule: under its ∀s, maybe after conditions (u = tt → if(u, v, w) = v).
function factRewrite(f) {
  const vars = []
  let g = f
  while (g.op === '∀') { vars.push(g.v); g = g.body }
  const free = (x) => vars.reduce((h, v) => subst(h, v, tvar(`?${v}`)), x)
  const conditions = []
  while (g.op === '→') { conditions.push(free(g.a)); g = g.b }
  // One whose left side is a bare variable (S x = S y → x = y) rewrites nothing in particular: not a rewrite rule.
  if (g.op === 'atom' && g.pred === '=') return g.args[0].t === 'var' && vars.includes(g.args[0].name) ? null : { lhs: free(g).args[0], rhs: free(g).args[1], conditions }
  if (g.op === '↔' && !conditions.length) return { lhs: free(g.a), rhs: free(g.b), conditions }
  return null
}

const targetOf = (at) => {
  const target = /^(?:goal|hyp-(\d+))-(\d+)$/.exec(at)
  return {
    inHyps: at === 'hyps' || target?.[1] !== undefined,
    hyp: target?.[1] === undefined ? undefined : Number(target[1]),
    occurrence: target ? Number(target[2]) : 0,
    explicit: Boolean(target),
  }
}

export const rewritesHyps = (at) => targetOf(at).inHyps

function rulesAt(goal, rule) {
  if (rule.group !== 'hyp') return [rule]
  if (rule.equivalenceOnly) {
    return goal.hyps.flatMap((h, sourceHyp) => h.op === '↔' && !metasIn(h).size ? [{
      ...rule, sourceHyp, lhs: rule.reverse ? h.b : h.a, rhs: rule.reverse ? h.a : h.b,
    }] : [])
  }
  return goal.hyps.map(hypRule).filter(Boolean).map((r) => ({ ...rule, ...r, conditions: [] }))
}

function* places(goal, rule, { inHyps, hyp }) {
  if (inHyps && rule.group === 'hyp' && !rule.equivalenceOnly) return
  const rules = rulesAt(goal, rule)
  if (!inHyps) {
    for (const local of rules) yield { formula: goal.goal, rule: local }
    return
  }
  for (const [index, formula] of goal.hyps.entries()) {
    if (hyp !== undefined && index !== hyp) continue
    // Keep the equivalence used by this step in the context.
    for (const local of rules) if (local.sourceHyp !== index) yield { formula, hyp: index, rule: local }
  }
}

/** The available occurrences for the first rule that matches each sentence. */
export function rewriteOptions(state, rules) {
  const goal = state?.goals?.[0]
  if (!goal || state.error) return []
  const seen = new Set()
  const options = []
  for (const rule of rules) {
    for (const inHyps of [false, true]) {
      for (const { formula, hyp, rule: local } of places(goal, rule, { inHyps })) {
        if (seen.has(hyp)) continue
        const matches = [...rewriteMatches(formula, local)]
        if (!matches.length) continue
        seen.add(hyp)
        const original = matches.reduce((tree, { path }) => replaceAt(tree, path, { ...atPath(tree, path) }), formula)
        matches.forEach(({ path, depth, replacement }, index) => options.push({
          value: hyp === undefined ? `goal-${index}` : `hyp-${hyp}-${index}`,
          label: '', original, node: atPath(original, path), path, replacement, hyp, index, depth,
        }))
      }
    }
  }
  return options.sort((a, b) => (a.hyp ?? -1) - (b.hyp ?? -1))
}

/** An unset position follows the first match, checking the goal before the givens. */
export function rewriteTarget(at, options) {
  return at ?? options[0]?.value
}

/** The full sentence after the selected replacement, with its inserted node available for marking. */
export function rewritePreview({ original, path, replacement }) {
  const node = { ...replacement }
  return { original: replaceAt(original, path, node), node }
}

/** Rewrite one place in the first goal. A rule's instantiated conditions follow the rewritten goal. */
export function rewrite(s, rule, at = 'goal') {
  const g = s.goals[0]
  if (!g) return { fail: NO_GOALS }
  const target = targetOf(at)
  for (const { formula, hyp, rule: local } of places(g, rule, target)) {
    const matches = rewriteMatches(formula, local)
    let match = matches.next().value
    if (!match) continue
    for (let index = 0; match && index < target.occurrence; index++) match = matches.next().value
    if (!match) break
    const changed = replaceAt(formula, match.path, match.replacement)
    const goal = hyp === undefined ? { ...g, goal: changed } : { ...g, hyps: g.hyps.map((x, i) => i === hyp ? changed : x) }
    const conditions = local.conditions.map((c) => ({ ...g, goal: instantiate(c, match.σ) }))
    return { results: [{ ...s, more: undefined, error: undefined, goals: [goal, ...conditions, ...s.goals.slice(1)] }] }
  }
  if (target.explicit) return { fail: T('找不到选定的第 {index} 处匹配', { index: target.occurrence + 1 }) }
  if (target.inHyps) {
    if (rule.equivalenceOnly) return { fail: T('已知里的等价式都无法改写另一条已知') }
    if (rule.group === 'hyp') return { fail: T('已知里的等式只用来改目标') }
    return { fail: T("「{zh}」的左边在第一个目标的已知里哪一处都对不上", {zh: { zh: String(rule.name.zh), en: String(rule.name.en) }}) }
  }
  if (rule.equivalenceOnly) return { fail: T('已知里的等价式都无法改写当前目标') }
  if (rule.group === 'hyp') return { fail: T('目标的已知里，没有一条等式或等价对得上第一个目标的哪一处') }
  return { fail: T("「{zh}」的左边在第一个目标里哪一处都对不上", {zh: { zh: String(rule.name.zh), en: String(rule.name.en) }}) }
}

/**
 * simp, as the player builds it: round after round, the first rule (in order) that fits rewrites the first goal once;
 * until no rule fits. (A repeat frame around alternatives holding one rewrite each.)
 */
export function simplify(s, rules, at = 'goal', limit = 60) {
  let cur = s
  for (let k = 0; k < limit; k++) {
    const next = rules.map((r) => rewrite(cur, r, at)).find((x) => !x.fail)
    if (!next) return { results: [cur] }
    cur = next.results[0]
  }
  return { fail: T("改了 {limit} 次还没停下来：有几条规则把句子改来改去", {limit}) }
}

/* ---------- the rule book ---------- */

const plain = (f) => show(f)
/** A level's definitions as rules: 'l = r' or 'c1; c2 ⟹ l = r', their variables (u … z) standing for anything. */
function defRule(text, k) {
  const m = /^(?:(.*)⟹)?(.*)$/.exec(text)
  const free = (f) => [...freeIn(f)].reduce((g, v) => subst(g, v, tvar(`?${v}`)), f)
  const eq = free(parseS(m[2].trim()))
  const conditions = m[1] ? m[1].split(';').map((c) => free(parseS(c.trim()))) : []
  return { key: `def.${k}`, name: { zh: text, en: text }, lhs: eq.args[0], rhs: eq.args[1], conditions, group: 'def', text }
}

const books = new WeakMap()
// Normalize schematic names across both sides, so a commutativity rule is its own converse by renaming.
function rewriteShape(from, to) {
  const names = new Map()
  return JSON.stringify([from, to].map((formula) => plain(formula).replace(/\?[A-Za-z][\w]*/g, (name) => {
    if (!names.has(name)) names.set(name, names.size)
    return `?${names.get(name)}`
  })))
}

/** Rewrite directions whose converse follows from an available form of the same lemma. */
export function lemmaRewrites(type, lemma, held) {
  const available = held ?? lemma.forms?.map((form) => form.key)
  const rules = lemmaRules(type, lemma).filter((rule) => rule.premises.length === 1
    && (!lemma.forms || available.includes(rule.key.split('.')[1] ?? lemma.forms[0].key)))
  const shapes = new Set(rules.map((rule) => rewriteShape(rule.premises[0].show, rule.conclusion)))
  return rules.filter((rule) => shapes.has(rewriteShape(rule.conclusion, rule.premises[0].show)))
    .map((rule) => ({ key: rule.key, name: rule.name, lhs: rule.premises[0].show, rhs: rule.conclusion, conditions: [], group: 'law' }))
}

/** Rewrites supplied by a task's definitions, proved equations, and current givens. */
export function localRewrites(level) {
  const defs = (level.defs ?? []).map(defRule)
  const facts = Object.entries(level.facts ?? {}).filter(([type]) => !level.proven || level.proven.includes(type)).map(([type, f]) => [type, f, factRewrite(parseS(f.statement))]).filter(([, , r]) => r)
    .map(([type, f, r]) => ({ key: type, name: f.name, ...r, group: 'fact' }))
  const hyp = { key: 'hyp', name: T('已知里的等式'), lhs: null, rhs: null, conditions: [], group: 'hyp' }
  const source = level.ruleParts?.['logic/iffSubst']
  const equivalences = source && (!level.holds || level.holds.includes(source))
    ? [
      { ...hyp, key: 'hyp.iff', name: level.partDefs[source].name, source, equivalenceOnly: true },
      { ...hyp, key: 'hyp.iff.reverse', name: level.partDefs[source].name, source, equivalenceOnly: true, reverse: true },
    ] : []
  return [...facts, ...defs, hyp, ...equivalences]
}
/**
 * A level's rewrite rules by key: each shape of a lemma whose converse shape the level holds too (keyed as the rule
 * book keys it, machine.js), the level's definitions, and 'hyp' (the goal's hypotheses).
 */
export function rewriteBookOf(level) {
  if (!books.has(level)) {
    const has = (p) => !level.holds || level.holds.includes(p)
    const laws = Object.entries(level.lemmas ?? {}).filter(([type]) => has(type))
      .flatMap(([type, lemma]) => lemmaRewrites(type, lemma, level.forms?.[type]))
    books.set(level, Object.fromEntries([...laws, ...localRewrites(level)].map((r) => [r.key, r])))
  }
  return books.get(level)
}
/** A rewrite rule stated with its required conditions on the left. */
export const rewriteText = (r, formula = show, term = showTerm) => {
  if (r.group === 'hyp') return r.equivalenceOnly ? equivalenceSubstitution(r.reverse)
    : `${equalitySubstitution}; ${equivalenceSubstitution(false)}`
  const showSide = (side) => isTerm(side) ? `C[${term(side)}]` : sideText(side, formula, term)
  return inferenceText([...r.conditions.map(formula), showSide(r.lhs)], showSide(r.rhs))
}
