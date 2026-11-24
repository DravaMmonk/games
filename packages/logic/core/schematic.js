// Rules with metavariables (《证明完毕》 chapter 8 on), the way Isabelle writes them: a rule is ⟦premises⟧ ⟹ conclusion,
// with metavariables for any sentence (?A), any thing (?t) and any sentence about some things (?P(x)). Using a rule
// means unifying: solving equations s ≐ t between sentences (or things) that have such letters, by a handful of rules,
// each a card of the machine board (machine.js). A metavariable applied to distinct bound variables, ?P(x) ≐ x是人 under
// ∀x, is a pattern (Miller's higher-order patterns) and is solved as a function, ?P ≐ fun x => x是人; any other
// application (?P(?t) ≐ 苏格拉底会死) has more than one solution and is left alone.
//
//   side      a formula (formula.js) or a term; ¬A is read as A → ⊥ and A ↔ B as (A → B) ∧ (B → A)
//   lam       { op: 'lam', params: [name], body: formula }   what a pattern's metavariable stands for
//   equation  { s, t, bound: [name] }   bound: the variables bound around it (a quantifier taken apart), written ⋀x.
//   set       { eqs: [equation], fail: null | { zh, en } }
//   σ         { metavariable name: side | lam }
//
// Some things are fixed (a, b … that a for-any box or Take the one there is took): a metavariable left by a rule may
// only become a thing that was fixed before it was left (`scopes`: { name: [fixed name] }, `fixed`: every fixed name).
import { BOT, all, atom, bin, ex, fn, meta, parse, same, sameTerm, show, showTerm, subst, substMany, tvar, unfoldConnective } from './formula.js'
import { T } from 'kernel/words'

export const isMetaName = (name) => name.startsWith('?')
const isTerm = (x) => 't' in x
const VARS = ['x', 'y', 'z', 'u', 'v', 'w']

/** A sentence or thing written with metavariables: lower-case names are things (u … z, xs, ys, zs variables), ?A, ?t, ?P(x) letters. */
export function parseS(text) {
  const names = text.match(/(?:^|[^?A-Za-z0-9_'])([a-z][A-Za-z0-9_']*)/g)?.map((m) => m.replace(/^[^a-z]/, '')) ?? []
  return parse(text, { consts: names.filter((n) => !/^([u-z]|[xyz]s)\d*$/.test(n)) })
}
/** A side of an equation, as written: a thing when it reads as one (ann, ?t, s(x)), else a sentence. */
export function parseSide(text) {
  const t = text.trim()
  return /^\??[a-z][A-Za-z0-9_']*(\(.*\))?$/.test(t) ? parseS(`${t} = ${t}`).args[0] : parseS(t)
}
/** An equation s ≐ t, as written. */
export const parseEquation = (text) => {
  const [s, t] = text.split('≐')
  return { s: parseSide(s), t: parseSide(t), bound: [] }
}

/* ---------- shape ---------- */

/** A bare metavariable's name (?A, ?t), or null. */
export function flexName(x) {
  if (isTerm(x)) return x.t === 'var' && isMetaName(x.name) ? x.name : null
  return x.op === 'meta' && isMetaName(x.name) && !x.args?.length ? x.name : null
}
/** A metavariable applied to things (?P(x)), or null. */
const flexApp = (x) => (!isTerm(x) && x.op === 'meta' && x.args?.length ? x : null)
const flex = (x) => Boolean(flexName(x) || flexApp(x))
// What a side is made of when it is not a metavariable: a key that two sides must share, and its parts; a quantifier
// is its own kind, taken apart with its variable.
function head(x0) {
  if (isTerm(x0)) return x0.t === 'var' ? (isMetaName(x0.name) ? null : { key: `v ${x0.name}`, args: [] }) : { key: `f ${x0.f}/${x0.args.length}`, args: x0.args }
  const x = unfoldConnective(x0)
  switch (x.op) {
    case 'meta': return null
    case 'atom': return { key: `p ${x.pred}/${x.args.length}`, args: x.args }
    case '⊥': return { key: '⊥', args: [] }
    case '∀': case '∃': return { key: x.op, binder: true, args: [] }
    case 'lam': return { key: `λ${x.params.length}`, binder: true, args: [] }
    default: return { key: x.op, args: [x.a, x.b] }
  }
}
/** Are two sides the same (up to the names of bound variables)? */
export function sameSide(a, b) {
  if (isTerm(a) || isTerm(b)) return isTerm(a) && isTerm(b) && sameTerm(a, b)
  if (a.op === 'lam' || b.op === 'lam') return a.op === b.op && a.params.length === b.params.length && same(a.body, b.body, a.params.map((name, k) => [name, b.params[k]]))
  return same(a, b)
}

/** The metavariables in a side. */
export function metasIn(x, out = new Set()) {
  if (isTerm(x)) {
    if (x.t === 'var') { if (isMetaName(x.name)) out.add(x.name) } else x.args.forEach((a) => metasIn(a, out))
    return out
  }
  switch (x.op) {
    case 'meta': if (isMetaName(x.name)) out.add(x.name); (x.args ?? []).forEach((a) => metasIn(a, out)); break
    case 'atom': x.args.forEach((a) => metasIn(a, out)); break
    case '¬': metasIn(x.a, out); break
    case '∀': case '∃': case 'lam': metasIn(x.body, out); break
    default: if (x.a) { metasIn(x.a, out); metasIn(x.b, out) }
  }
  return out
}
// The names of things in a side, free (a variable bound inside it is left out).
function namesIn(x, out = new Set(), bound = new Set()) {
  if (isTerm(x)) {
    if (x.t === 'var') { if (!bound.has(x.name)) out.add(x.name) } else { if (!x.args.length) out.add(x.f); x.args.forEach((a) => namesIn(a, out, bound)) }
    return out
  }
  switch (x.op) {
    case 'meta': case 'atom': (x.args ?? []).forEach((a) => namesIn(a, out, bound)); break
    case '¬': namesIn(x.a, out, bound); break
    case '∀': case '∃': namesIn(x.body, out, new Set([...bound, x.v])); break
    case 'lam': namesIn(x.body, out, new Set([...bound, ...x.params])); break
    default: if (x.a) { namesIn(x.a, out, bound); namesIn(x.b, out, bound) }
  }
  return out
}

/* ---------- substitution ---------- */

const beta = (lambda, args) => substMany(lambda.body, lambda.params.map((name, k) => [name, args[k]]))
/** A side with every metavariable σ knows replaced, all the way down. */
export function instantiate(x, σ) {
  if (isTerm(x)) {
    if (x.t === 'var') return isMetaName(x.name) && σ[x.name] ? instantiate(σ[x.name], σ) : x
    return fn(x.f, x.args.map((a) => instantiate(a, σ)))
  }
  switch (x.op) {
    case 'meta': {
      const args = (x.args ?? []).map((a) => instantiate(a, σ))
      const v = σ[x.name]
      if (!v) return args.length ? { ...x, args } : x
      return instantiate(v.op === 'lam' ? beta(v, args) : v, σ)
    }
    case 'atom': return atom(x.pred, x.args.map((a) => instantiate(a, σ)))
    case '¬': return { op: '¬', a: instantiate(x.a, σ) }
    case '∀': case '∃': return { ...x, body: instantiate(x.body, σ) }
    case 'lam': return { ...x, body: instantiate(x.body, σ) }
    case '⊥': return x
    default: return bin(x.op, instantiate(x.a, σ), instantiate(x.b, σ))
  }
}
const instEq = (e, σ) => ({ ...e, s: instantiate(e.s, σ), t: instantiate(e.t, σ) })
// An equation keeps only the bound variables it still mentions.
const tidy = (e) => {
  const used = new Set([...namesIn(e.s), ...namesIn(e.t)])
  return { ...e, bound: e.bound.filter((v) => used.has(v)) }
}

/* ---------- the rules of unification ---------- */

/** Show the things taken around a formula, premise or rule. */
export const withBinders = (fixes, text) => fixes?.length ? `⋀${fixes.join(' ')}. ${text}` : text

export const sideText = (x, formula = show, term = showTerm) => (isTerm(x) ? term(x) : x.op === 'lam' ? `fun ${x.params.join(' ')} => ${formula(x.body)}` : formula(x))
export const equationText = ({ bound, s, t }, say = sideText) => withBinders(bound, `${say(s)} ≐ ${say(t)}`)
const replaceAt = (eqs, i, ins) => [...eqs.slice(0, i), ...ins.map(tidy), ...eqs.slice(i + 1)]
// The variable two quantifiers taken apart share: theirs when they agree and it is free, else the first free one.
const freshBound = (e, [va, a], [vb, b]) => {
  const taken = new Set([...e.bound, ...[...namesIn(a)].filter((n) => n !== va), ...[...namesIn(b)].filter((n) => n !== vb)])
  const preferred = [va, vb, ...VARS].find((v) => !taken.has(v))
  if (preferred) return preferred
  let index = e.bound.length
  while (taken.has(`v${index}`)) index++
  return `v${index}`
}
// Why a metavariable X may not become t: it is inside t, t has a bound variable that would leave its quantifier, or t
// names a thing fixed after X was left (opts.scopes, opts.fixed). Null when it may.
function blocked(e, X, t, opts = {}) {
  if (metasIn(t).has(X)) return T("{value}：{X} 出现在另一边里面，代进去永远代不完", {value: equationText(e), X})
  const names = namesIn(t)
  const escapes = e.bound.filter((v) => names.has(v))
  if (escapes.length) return T("{value}：{value2} 是量词管着的，{X} 不能带走它", {value: equationText(e), X, value2: { zh: String(escapes.join('、')), en: String(escapes.join(', ')) }})
  const late = (opts.fixed ?? []).filter((n) => names.has(n) && !(opts.scopes?.[X] ?? []).includes(n))
  if (late.length) return T("{value}：{X} 是在取出 {value2} 之前留下的，不能变成后来才有的东西", {value: equationText(e), X, value2: { zh: String(late.join('、')), en: String(late.join(', ')) }})
  return null
}

/**
 * The rules, each applied once, to the first equation it applies to: { eqs, fail? }, or null when it applies to none.
 * opts { scopes, fixed } for the fixed-thing check.
 */
export const UNIFY_RULES = {
  // t ≐ t: drop it.
  delete: (eqs) => {
    const i = eqs.findIndex((e) => sameSide(e.s, e.t))
    return i < 0 ? null : { eqs: replaceAt(eqs, i, []) }
  },
  // Same shape on both sides: an equation for each pair of parts; a quantifier on both sides: their bodies, with one
  // variable for both.
  decompose: (eqs) => {
    const i = eqs.findIndex((e) => { const [a, b] = [head(e.s), head(e.t)]; return a && b && a.key === b.key && !sameSide(e.s, e.t) })
    if (i < 0) return null
    const e = eqs[i]
    const [a, b] = [head(e.s), head(e.t)]
    if (a.binder) {
      const [s, t] = [unfoldConnective(e.s), unfoldConnective(e.t)]
      if (s.op === 'lam') {
        const ps = []
        s.params.forEach((p, k) => ps.push(freshBound({ bound: [...e.bound, ...ps] }, [p, s.body], [t.params[k], t.body])))
        const args = ps.map(tvar)
        return { eqs: replaceAt(eqs, i, [{ s: beta(s, args), t: beta(t, args), bound: [...e.bound, ...ps] }]) }
      }
      const w = freshBound(e, [s.v, s.body], [t.v, t.body])
      return { eqs: replaceAt(eqs, i, [{ s: subst(s.body, s.v, tvar(w)), t: subst(t.body, t.v, tvar(w)), bound: [...e.bound, w] }]) }
    }
    return { eqs: replaceAt(eqs, i, a.args.map((x, k) => ({ s: x, t: b.args[k], bound: e.bound }))) }
  },
  // Different shapes, neither side a metavariable: no unifier.
  conflict: (eqs) => {
    const e = eqs.find((x) => { const [a, b] = [head(x.s), head(x.t)]; return a && b && a.key !== b.key })
    return e ? { eqs, fail: T("{value}：两边的样子不同，怎样代都对不上", {value: equationText(e)}) } : null
  },
  // A metavariable on the right only: turn it round.
  swap: (eqs) => {
    const i = eqs.findIndex((e) => flex(e.t) && (!flex(e.s) || (flexApp(e.s) && flexName(e.t))))
    return i < 0 ? null : { eqs: replaceAt(eqs, i, [{ ...eqs[i], s: eqs[i].t, t: eqs[i].s }]) }
  },
  // ?X ≐ t where ?X may not become t: no unifier.
  check: (eqs, opts) => {
    for (const e of eqs) {
      const X = flexName(e.s)
      if (!X || sameSide(e.s, e.t)) continue
      const why = blocked(e, X, e.t, opts)
      if (why) return { eqs, fail: why }
    }
    return null
  },
  // ?X ≐ t, ?X free to be t and still elsewhere: put t for ?X there.
  eliminate: (eqs, opts) => {
    const i = eqs.findIndex((e, k) => {
      const X = flexName(e.s)
      return X && !sameSide(e.s, e.t) && !blocked(e, X, e.t, opts) && eqs.some((d, j) => j !== k && (metasIn(d.s).has(X) || metasIn(d.t).has(X)))
    })
    if (i < 0) return null
    const σ = { [flexName(eqs[i].s)]: eqs[i].t }
    return { eqs: eqs.map((e, j) => (j === i ? e : tidy(instEq(e, σ)))) }
  },
  // ?P(x1, …, xn) ≐ t, the xi distinct bound variables and t about no other bound one: ?P ≐ fun x1 … xn => t.
  pattern: (eqs) => {
    const i = eqs.findIndex((e) => patternOf(e))
    if (i < 0) return null
    const e = eqs[i]
    const P = flexApp(e.s)
    return { eqs: replaceAt(eqs, i, [{ s: meta(P.name), t: { op: 'lam', params: P.args.map((a) => a.name), body: e.t }, bound: e.bound }]) }
  },
}
// Is an equation a pattern the last rule solves: { params } or null.
function patternOf(e) {
  const P = flexApp(e.s)
  if (!P || isTerm(e.t) || metasIn(e.t).has(P.name)) return null
  const params = P.args.map((a) => (a.t === 'var' && e.bound.includes(a.name) ? a.name : null))
  if (params.some((p) => !p) || new Set(params).size !== params.length) return null
  const names = namesIn(e.t)
  return e.bound.every((v) => params.includes(v) || !names.has(v)) ? { params } : null
}
/** An equation whose metavariable is applied but not to distinct bound variables, the one kind left alone. */
export const nonPattern = (eqs) => eqs.find((e) => (flexApp(e.s) || flexApp(e.t)) && !patternOf(e) && !patternOf({ ...e, s: e.t, t: e.s }))

/** Is a set solved: ?X1 ≐ t1, … with distinct metavariables on the left, none of them anywhere on a right? */
export function solved(eqs) {
  const lefts = eqs.map((e) => flexName(e.s))
  if (lefts.some((x) => !x) || new Set(lefts).size !== lefts.length) return false
  return eqs.every((e) => lefts.every((x) => !metasIn(e.t).has(x)) && !e.bound.some((v) => namesIn(e.t).has(v)))
}
export const solutionOf = (eqs) => Object.fromEntries(eqs.map((e) => [flexName(e.s), e.t]))

const ORDER = ['delete', 'decompose', 'conflict', 'swap', 'check', 'eliminate']
export const FULL = [...ORDER, 'pattern']
/**
 * Solve a set by the rules, in order, each time the first that applies, until it is solved, fails or none applies:
 * { eqs, fail }. `rules` is ORDER (the unifier: patterns left alone) by default; onStep(set, rule) sees each step.
 */
export function solveEqs(eqs0, { rules = ORDER, onStep = null, ...opts } = {}) {
  let set = { eqs: eqs0.map(tidy), fail: null }
  for (let k = 0; k < 400 && !set.fail && !solved(set.eqs); k++) {
    const rule = rules.find((r) => UNIFY_RULES[r](set.eqs, opts))
    if (!rule) break
    const next = UNIFY_RULES[rule](set.eqs, opts)
    set = { eqs: next.eqs, fail: next.fail ?? null }
    onStep?.(set, rule)
  }
  return set
}

/**
 * Unify pairs of sides, all at once, on top of what σ already knows: { σ } with σ extended, or { fail }. A pattern is
 * solved; another application of a metavariable fails as having no single solution.
 */
export function unify(pairs, σ = {}, opts = {}) {
  const set = solveEqs(pairs.map(([a, b]) => ({ s: instantiate(a, σ), t: instantiate(b, σ), bound: [] })), { rules: FULL, ...opts })
  if (set.fail) return { fail: set.fail }
  if (!solved(set.eqs)) {
    const e = nonPattern(set.eqs)
    return { fail: e ? T("{value}：{name} 后面跟的不都是不同的约束变量，解不止一个，证明器不猜", {value: equationText(e), name: (flexApp(e.s) ?? flexApp(e.t)).name}) : T('合一不了') }
  }
  // A solved set may still give a metavariable a thing fixed after it was left.
  const late = UNIFY_RULES.check(set.eqs, opts)
  if (late) return { fail: late.fail }
  const found = solutionOf(set.eqs)
  return { σ: { ...Object.fromEntries(Object.entries(σ).map(([k, v]) => [k, instantiate(v, found)])), ...found } }
}

/* ---------- rules ---------- */

//   rule      { key, name: { zh, en }, premises: [premise], conclusion: formula }
//   premise   { fixes: [variable], hyps: [formula], show: formula }   ⋀x. ⟦hyps⟧ ⟹ show (premiseOf reads one as written)
export const premiseOf = (text) => {
  // ⋀x. ⟦A; B⟧ ⟹ C, any part left out.
  const m = /^(?:⋀([a-z ]+)\.\s*)?(?:⟦(.*)⟧\s*⟹\s*)?(.*)$/.exec(text.trim())
  return { fixes: m[1] ? m[1].trim().split(/\s+/) : [], hyps: m[2] ? m[2].split(';').map(parseS) : [], show: parseS(m[3]) }
}
/** A rule from its premises and conclusion as written: ruleOf('conjI', name, ['?A', '?B'], '?A ∧ ?B'). */
export const ruleOf = (key, name, premises, conclusion) => ({ key, name, premises: premises.map(premiseOf), conclusion: parseS(conclusion) })

// A premise written out: a sentence; under premises of its own, those in ⟦⟧ then ⟹ (each a sentence, or a premise in
// turn): ⟦?A; ?B⟧ ⟹ ?C; one that takes things in brackets of its own, (⋀x. ⟦?P(x)⟧ ⟹ ?Q(x)).
function premiseText(p, say) {
  const inner = p.hyps.length ? `${premisesText(p.hyps.map((h) => (h.show ? h : { fixes: [], hyps: [], show: h })), say)} ⟹ ${say(p.show)}` : say(p.show)
  return p.fixes.length ? `(${withBinders(p.fixes, inner)})` : inner
}
/** A rule's premises as written before its ⟹: every group of premises in ⟦⟧, ⟦?A; ⟦?B⟧ ⟹ ?C⟧. */
export const premisesText = (premises, say = show) => `⟦${premises.map((p) => premiseText(p, say)).join('; ')}⟧`

// The identity rule checks a hypothesis in scope instead of reducing the goal to a premise.
export const ASSUMPTION_RULE = { key: 'assumption', part: 'logic/assumption', name: T('照抄'), fromHypothesis: true }

/** A rule written in Isabelle-style notation, with its binders and premises. */
export function ruleText(rule, say = show) {
  if (rule.fromHypothesis) return 'Γ, A ⊢ A'
  const goal = say(rule.conclusion)
  const text = rule.premises.length ? `${premisesText(rule.premises, say)} ⟹ ${goal}` : goal
  return withBinders(rule.fixes, text)
}

/**
 * A rule or a sentence as it is stated to a player (a part's rule, a declaration's, a rule on a wire): each of its
 * letters is any sentence and stands bare (A, P(x), R). The ? marks a letter only where a run of the machine leaves
 * it still to be found: in a proof state, or an equation to solve.
 */
export const stated = (text) => text.replace(/\?(?=[A-Za-z])/g, '')
export const statedRule = (rule, say = show) => stated(ruleText(rule, say))

/**
 * The kernel's rules as rules with metavariables, in the order a card lists them, each with the name of the card it
 * is on the proof board: introduction rules first (used on a goal), then elimination rules (the first premise a
 * hypothesis to use up), then the rest.
 */
// Each kernel rule belongs to the proof operation implemented by its source part.
const partRule = (part, key, name, premises, conclusion) => ({ ...ruleOf(key, name, premises, conclusion), part })
export const KERNEL_RULES = [
  partRule('andI', 'conjI', T("拼接"), ['?A', '?B'], '?A ∧ ?B'),
  partRule('impI', 'impI', T("假设框"), ['⟦?A⟧ ⟹ ?B'], '?A → ?B'),
  partRule('orI', 'disjI1', T("补充（左边）"), ['?A'], '?A ∨ ?B'),
  partRule('orI', 'disjI2', T("补充（右边）"), ['?B'], '?A ∨ ?B'),
  partRule('allI', 'allI', T("任取框"), ['⋀x. ?P(x)'], '∀x. ?P(x)'),
  partRule('exI', 'exI', T("概括"), ['?P(?t)'], '∃x. ?P(x)'),
  partRule('mp', 'mp', T("套用"), ['?A → ?B', '?A'], '?B'),
  partRule('andE', 'conjE', T("拆解"), ['?A ∧ ?B', '⟦?A; ?B⟧ ⟹ ?C'], '?C'),
  partRule('andE', 'conjunct1', T("拆解（左边）"), ['?A ∧ ?B'], '?A'),
  partRule('andE', 'conjunct2', T("拆解（右边）"), ['?A ∧ ?B'], '?B'),
  partRule('orE', 'disjE', T("分类讨论"), ['?A ∨ ?B', '⟦?A⟧ ⟹ ?C', '⟦?B⟧ ⟹ ?C'], '?C'),
  partRule('mp', 'impE', T("用上「若…则…」"), ['?A → ?B', '?A', '⟦?B⟧ ⟹ ?C'], '?C'),
  partRule('botE', 'botE', T("爆炸"), ['⊥'], '?C'),
  partRule('allE', 'spec', T("选定一例"), ['∀x. ?P(x)'], '?P(?t)'),
  partRule('allE', 'allE', T("选定一例后再使用"), ['∀x. ?P(x)', '⟦?P(?t)⟧ ⟹ ?C'], '?C'),
  partRule('exE', 'exE', T("实例框"), ['∃x. ?P(x)', '⋀x. ⟦?P(x)⟧ ⟹ ?C'], '?C'),
  partRule('raa', 'raa', T("反证法"), ['¬¬?A'], '?A'),
  // A sentence proved on the way and then used, as a wire on the proof board does (Lean's have).
  partRule('mp', 'cut', T("先证一句"), ['?A', '⟦?A⟧ ⟹ ?C'], '?C'),
  partRule('refl', 'refl', T("自反律"), [], '?t = ?t'),
]
/** The introduction rules (a goal taken apart by its shape) and the elimination rules (a given used), in order. */
export const INTRO_RULES = ['conjI', 'impI', 'disjI1', 'disjI2', 'allI', 'exI']
export const ELIM_RULES = ['conjE', 'disjE', 'impE', 'botE', 'exE', 'allE']

// A lemma's letters are ?-letters as a rule; a letter under a quantifier is about its variable (∀x. P is ∀x. ?P(x)).
function metaRule(f, letters, bound = []) {
  if (f.op === 'meta' || (f.op === 'atom' && !f.args.length && letters.includes(f.pred))) {
    const name = `?${f.name ?? f.pred}`
    return bound.length ? { op: 'meta', name, args: bound.map(tvar) } : meta(name)
  }
  if (f.op === '¬') return { op: '¬', a: metaRule(f.a, letters, bound) }
  if (f.op === '∀' || f.op === '∃') return (f.op === '∀' ? all : ex)(f.v, metaRule(f.body, letters, [...bound, f.v]))
  if (f.a) return bin(f.op, metaRule(f.a, letters, bound), metaRule(f.b, letters, bound))
  return f
}
/** The rules a lemma (course LEMMAS) gives: one per shape it has, named after it (and the shape). */
export function lemmaRules(type, l) {
  const forms = l.forms ?? [{ key: null, statement: l.statement, premises: l.premises ?? [] }]
  const read = (text) => metaRule(parse(text, { metas: l.metas }), l.metas)
  return forms.map((f) => ({
    key: f.key ? `${type}.${f.key}` : type,
    name: f.key ? T("{zh} {label}", {label: f.label, zh: { zh: String(l.name.zh), en: String(l.name.en) }}) : l.name,
    premises: f.premises.map((p) => ({ fixes: [], hyps: [], show: read(p) })),
    conclusion: read(f.statement),
    lemma: type,
  }))
}
