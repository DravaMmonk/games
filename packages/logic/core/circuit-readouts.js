import { punctuation } from 'kernel'
// Case inputs and values as the circuit screen and text play show them.
import { L } from "kernel"
import { T, tr } from 'kernel/words'
import { parse } from './formula.js'
import { inputsOf, inputsOfLevel, parseGoal, ruleWritten } from './machine.js'
import { say, sayTerm } from './notation.js'
import { printTerm } from './pterm.js'
import { typeText } from './datatype.js'
import { certificate, clauseFormula, refuted } from './resolution.js'
import { elimOf } from './elimgen.js'
import { equationText, ruleText, sideText, withBinders } from './schematic.js'

// The words a test reads in: its last test (the bare letters) in the letters' own words.
const wordsOf = (task, test) => (test?.symbolic ? { ...task.notation, words: task.symbolicWords ?? null, propertyWords: false } : task.notation)
export const proofTextOf = (task, test) => (f) => L(say(f, wordsOf(task, test)))

/** A value in words: a formula with its proof term when the task shows proof terms. */
function showProof(v, { task, test }) {
  if (v === undefined || v === null) return '—'
  if (typeof v === 'string') return v
  const f = say(v.formula ?? v, wordsOf(task, test))
  if (!task.terms || !v.term) return f
  const term = printTerm(v.term)
  return T("{zh} · {term}", {term, zh: { zh: String(f.zh), en: String(f.en) }})
}

/** A test's premises and the goal for its output card. */
const proofEntries = ({ task, test, run }) => {
  const consts = task.consts ?? []
  return [
    ...Object.entries(test?.premises ?? {}).map(([name, text], k, all) => ({ of: name, label: all.length > 1 ? T("已知 {k}", {k: k + 1}) : T("已知"), shape: 'scalar', given: parse(text, { consts }) })),
    ...(test ? [{ of: 'goal', label: T("目标"), shape: 'scalar', want: parse(test.goal, { consts }), got: run?.outputs?.goal?.formula }] : []),
  ]
}

export const machineTextOf = (task) => (f) => L(say(f, task.notation))
export const machineTermOf = (task) => (t) => L(sayTerm(t, task.notation))
const goalText = (g, text) => withBinders(g.fixes, g.hyps.length ? `${g.hyps.map(text).join(punctuation("；"))} ⊢ ${text(g.goal)}` : text(g.goal))
// Marks: a goal is its turnstile, numbered when a state has more than one (⊢₁ ⊢₂ …, a lone goal plain ⊢); a rule is R,
// numbered once for the whole board (R₁ R₂ …: the run's `rules`, ./machine.js boardRules; a lone rule plain R). A rule
// part's card shows only the rules it adds (`own`), not those wired in before it. A goal with no
// hypotheses keeps its turnstile in front.
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const sub = (n) => String(n).replace(/\d/g, (d) => SUB[d])
const goalMark = (k, count) => (count > 1 ? `⊢${sub(k + 1)}` : '⊢')
const markedGoal = (g, text, mark) => withBinders(g.fixes, g.hyps.length ? `${g.hyps.map(text).join(punctuation("；"))} ${mark} ${text(g.goal)}` : `${mark} ${text(g.goal)}`)
const ruleMark = (key, order) => (order.length > 1 ? `R${sub(order.indexOf(key) + 1)}` : 'R')
const orderOf = (v, run) => (run?.rules && v.keys.every((k) => run.rules.includes(k)) ? run.rules : [...new Set(v.entries.map((e) => e.key))])
/** A state's goals, a line each, marked ⊢₁ ⊢₂ … (the run report's boxes hold only these). */
export const goalLines = (v, task) => {
  const text = machineTextOf(task)
  return v.goals.map((g, k) => markedGoal(g, text, goalMark(k, v.goals.length)))
}
/** The rules on the board, a line each, marked R₁ R₂ … (the run report lists them first). */
export const ruleLines = ({ ruleEntries: entries = [], rules: order = [] }, task) => {
  const text = machineTextOf(task)
  const term = machineTermOf(task)
  return order.map((key) => ({ mark: ruleMark(key, order), text: ruleWritten(entries.find((e) => e.key === key), text, term) }))
}
/** What a tactic did (machine.js `did`), in marks: ⊢ ⟵ R₁ (a rule backwards), ⊢ ≡ R₁ (a rewrite), ⊢ ✓ (a hypothesis
 *  closes it), ⊢ ⤓ (moved to the end). */
export function didText(did, run) {
  const goal = goalMark(0, did.goals)
  const rules = (did.rules ?? []).map((key) => ruleMark(key, run?.rules ?? did.rules)).join(' ')
  if (did.op === 'rule') return `${goal} ⟵ ${rules}`
  if (did.op === 'rw') return `${goal} ≡ ${rules}`
  if (did.op === 'rwHyps') return T("{goal} 的已知 ≡ {rules}", { goal, rules })
  if (did.op === 'assumption') return `${goal} ✓`
  if (did.op === 'alternatives') return null
  return `${goal} ⤓`
}
/**
 * What a step of the run report did, in a sentence (its ⓘ): a tactic's work (machine.js `did`), a repeat frame's
 * decision (↻ once more, ↪ out), or why a card could not do its step. Null for a step with nothing to say.
 */
export function stepExplained(entry, run) {
  const v = entry.value
  if (v?.kind === 'state' && v.error && !v.didBy) return v.error
  if (entry.inner && entry.label === '↻') return T('这一轮改变了证明状态，再做一轮。')
  if (entry.inner && entry.label === '↪') return T('停下来：这一轮没有改变、做不成，或者已经证完。交出的是最后的状态。')
  const did = v?.didBy === entry.id ? v.did : null
  if (!did) return null
  if (did.op === 'alternatives') {
    if (!did.backtrack) return T('继续走第 {route} 条路。', { route: did.remaining[0] })
    return T('从路线 {routes} 保留 {count} 个候选结果。', { routes: did.remaining.join(punctuation('、')), count: did.results })
  }
  const goal = goalMark(0, did.goals)
  const rules = (did.rules ?? []).map((key) => ruleMark(key, run?.rules ?? did.rules)).join(' ')
  if (did.op === 'rule') return T('倒着用 {rules}：它的结论对上目标 {goal}，目标换成它的前提。', { rules, goal })
  if (did.op === 'rw') return T('用 {rules} 改写目标 {goal}。', { rules, goal })
  if (did.op === 'rwHyps') return T('用 {rules} 改写目标 {goal} 的已知。', { rules, goal })
  if (did.op === 'assumption') return T('目标 {goal} 和它的一条已知对上，证完了。', { goal })
  return T('把目标 {goal} 移到最后，先做后面的。', { goal })
}
// A generator value in one line: a value that takes things first reads as a rule does, ⋀x. in front.
const genValueText = (v, text) => (v.kind === 'sentence' ? text(v.f) : v.kind === 'rule' ? ruleText(v.rule, text) : v.kind === 'any' ? withBinders(v.vars, genValueText(v.body, text)) : v.items.map((x) => genValueText(x, text)).join(punctuation("；")))

/**
 * A value in words, a line each: a sentence, a rule, a list; the rules a rule part gives (R₁ …, numbered for the board
 * when a run is given); a proof state's goals (⊢₁ …) (or that
 * it is proved, or that the step failed, and why); equations; a clause set, once ⊥ is in only the clauses ⊥ comes from.
 * Each line is prose or a formula (`formula`: what the board typesets); showMachine joins them as text.
 */
export function machineLines(v, { task, run }) {
  // Prose is a note on the value (why a step failed, how many results) or, `result`, the value itself said in words.
  const prose = (list) => list.filter(Boolean).map((s) => ({ s, formula: false }))
  const result = (s) => (s ? [{ s, formula: false, result: true }] : [])
  const formulas = (list) => list.map((s) => ({ s, formula: true }))
  if (v === undefined || v === null) return prose(['—'])
  if (typeof v === 'string') return prose([v])
  if (v.kind === 'want') return v.lines
  const text = machineTextOf(task)
  const term = machineTermOf(task)
  if (v.kind === 'sentence' || v.kind === 'rule' || v.kind === 'any') return formulas([genValueText(v, text)])
  if (v.kind === 'list') return formulas(v.items.map((x, k) => `${k + 1}. ${genValueText(x, text)}`))
  if (v.kind === 'rules') {
    const order = orderOf(v, run)
    const shown = v.own === undefined ? v.entries : v.entries.slice(v.entries.length - v.own)
    return formulas(shown.map((e) => `${ruleMark(e.key, order)} ${ruleWritten(e, text, term)}`))
  }
  if (v.kind === 'state') {
    const others = v.more?.length ?? 0
    return [
      ...prose([v.error && `${tr("这一步失败")}：${L(v.error)}`]),
      ...result(!v.goals.length && tr('证明完毕')),
      ...prose([others > 0 && tr("第 1 种结果，共 {others} 种", {others: others + 1})]),
      ...formulas(goalLines(v, task)),
    ]
  }
  if (v.kind === 'eqs') return [...prose([v.fail && `${tr('合一失败')}：${L(v.fail)}`]), ...result(!v.eqs.length && tr('没有等式了')), ...formulas(v.eqs.map((e) => equationText(e, (side) => sideText(side, text, term))))]
  const shown = certificate(v.set) ?? v.set.map((_, i) => i)
  return [...result(refuted(v.set) && tr('推出了空子句 ⊥')), ...prose([v.endless && tr("仍在增加")]), ...formulas(shown.map((i) => `${i + 1}. ${text(clauseFormula(v.set[i]))}${v.set[i].from ? ` ← ${v.set[i].from.map((k) => k + 1).join(punctuation("、"))}` : ''}`))]
}
const showMachine = (v, ctx) => machineLines(v, ctx).map((l) => l.s).join('\n')

const WANT = {
  'logic/elim': T('这份声明的消去规则'),
  'logic/clauses': T('拆成的子句'),
  'logic/refuted': T('推出空子句 ⊥'),
  'logic/decide': T('能推出 ⊥ 时推出 ⊥；否则饱和至不再产生新子句'),
  'logic/unify': T('解完的等式（能合一时），或者「失败」（不能时）'),
  'logic/answers': T('找出所有答案'),
  'logic/fails': T('证不出时停止，并报告证不出'),
  'logic/proved': T('证明完毕'),
}
/** What a test wants of the result, in words: the results a step makes, the elimination rule, or the level's want. */
// What a test wants, as lines (`kind: 'want'`, machineLines): words, and the goals or the rule wanted as formulas, so a
// card typesets them as it does every other formula.
function wantOf(task, test) {
  const text = machineTextOf(task)
  const prose = (s) => ({ s, formula: false })
  const formula = (s) => ({ s, formula: true })
  if (test.becomes) {
    if (!test.becomes.length) return tr("这一步失败", {}, "circuit-readouts")
    const ways = test.becomes.map((r) => (r.length ? formula(r.map((g) => goalText(parseGoal(g), text)).join(' | ')) : prose(tr('证完'))))
    return { kind: 'want', lines: ways.flatMap((w, k) => (k ? [prose(tr('或者')), w] : [w])) }
  }
  if (test.elim) return { kind: 'want', lines: [prose(tr('消去规则 ').trim()), formula(ruleText(elimOf(test), text))] }
  return L(WANT[test.want ?? task.want])
}

/** What the results show of a test: the types and definitions it reads, its inputs, and at the output what it wants (the result once run). */
const machineEntries = ({ task, test, run }) => {
  if (!test) return []
  const term = machineTermOf(task)
  const labels = new Map(inputsOfLevel(task).map((i) => [i.name, i.label]))
  return [
    ...(task.datatypes ? [{ of: 'types', label: T('类型'), shape: 'scalar', given: Object.entries(task.datatypes).map(([type, d]) => typeText(type, d, term)).join(punctuation("；")) }] : []),
    ...Object.entries(inputsOf(test, task)).map(([name, v]) => ({ of: name, label: labels.get(name) ?? T("输入"), shape: 'scalar', given: v })),
    { of: 'out', label: T("预期"), shape: 'scalar', want: wantOf(task, test), got: run?.outputs?.out },
  ]
}

export const proofReadout = { show: showProof, entries: proofEntries }
export const machineReadout = { show: showMachine, entries: machineEntries }
