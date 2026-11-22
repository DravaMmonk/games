import { completionResult } from 'kernel'
import { T } from 'kernel/words'
import { freeVars, showTerm } from './formula.js'
import { parseS, parseSide, statedRule } from './schematic.js'
import { say, sayTerm } from './notation.js'
import { complete, straysOf, termChips } from './formulaTree.js'
import { checkDefine } from './define.js'
import { declaredRules, sentenceOf } from './iso.js'
import { blankRule, checkDeclaration, linesOf, premiseChips, problemsOf } from './ruleLines.js'
import { sentenceLanguage } from './sentenceLanguage.js'

const blank = T('未写完')
const changeAt = (items, at, fn) => items.map((item, k) => k === at ? fn(item) : item)
const without = (items, at) => items.filter((_, k) => k !== at)
const whole = (tree) => Boolean(tree) && complete(tree) && !straysOf(tree).length

export const declarationResult = rules => completionResult({ steps: rules.length })

export function declarationValues(level, rules, change, scope) {
  const binder = level.binder ?? 'x'
  const words = (value) => say(value, level.notation)
  const chips = premiseChips(level)
  const singleRule = level.play === 'logic/rule' || level.ruleAudit
  const editableDeclaration = change && !singleRule
  const numbered = rules.length > 1
  const problems = editableDeclaration ? problemsOf(level, rules, chips) : []
  // An inductive declaration takes the things its premises mention without a switch: every name besides the declared
  // sentence's own is taken afresh by the row that uses it.
  const auto = Array.isArray(level.params)
  const taken = (rule) => auto ? { ...rule, binds: [...new Set(rule.needs.filter(whole).flatMap((need) => [...freeVars(need)]))].filter((v) => !level.params.includes(v)) } : rule
  const withRule = (k, fn) => change(changeAt(rules, k, (rule) => taken(fn(rule))))
  return {
    className: 'lg-rule-table',
    head: level.target ? { name: singleRule ? T("结论") : T("待验证结论"), goal: words(sentenceOf(level, level.target)), end: T('为真。') } : null,
    rows: rules.map((rule, k) => ({
      name: T("可推导情形"), mark: numbered ? k + 1 : undefined,
      toggle: !auto && level.thing && { on: rule.binds.length > 0, label: T("任取 {binder}", {binder}), run: () => withRule(k, (r) => ({ ...r, binds: r.binds.length ? [] : [binder] })) },
      slots: rule.needs.map((need, j) => ({ text: whole(need) ? words(need) : null, fixed: j < (level.fixedPremises ?? 0), bad: problems.some((p) => p.row === k && p.slot === j) })),
      end: rule.needs.length > 1 ? T('均为真。') : T('为真。'),
      empty: T('无需前提'),
      add: { label: numbered ? T("给可推导情形 {k} 添加前提", {k: k + 1}) : T("添加前提"), text: rule.needs.length ? null : T('添加前提'), run: () => withRule(k, (r) => ({ ...r, needs: [...r.needs, null] })) },
      drop: editableDeclaration && { label: numbered ? T("删除可推导情形 {k}", {k: k + 1}) : T("删除可推导情形"), run: () => change(without(rules, k)) },
    })),
    editor: change && {
      slot: (k, j) => ({
        title: numbered ? T("可推导情形 {k} 的前提", {k: k + 1}) : T("前提"),
        tree: rules[k].needs[j], chips, language: auto ? sentenceLanguage(level.notation, 'formula') : sentenceLanguage(level.notation, 'formula', rules[k].binds), scope: `${scope}:${k}.${j}`,
        onChange: (tree) => withRule(k, (r) => ({ ...r, needs: changeAt(r.needs, j, () => tree) })),
      }),
      close: (k, j) => {
        if (rules[k]?.needs[j] === null) withRule(k, (r) => ({ ...r, needs: without(r.needs, j) }))
      },
    },
    more: editableDeclaration && { text: T("添加可推导情形"), run: () => change([...rules, blankRule()]) },
    blank,
  }
}

/** The introduction rules as entered, and the generated elimination rule. */
export function ruleLines(level, ways, read) {
  // With no derivable situation there is no intro rule, and the elim rule takes the sentence to anything (⊥).
  const text = (f) => read(say(f, level.notation))
  const { make, take } = declaredRules(level, ways, (f) => f)
  return [
    ...make.map((rule, k) => ({ name: read(T("引入规则")), mark: k + 1, text: statedRule(rule, text) })),
    { name: read(T("消去规则")), text: statedRule(take, text) },
  ]
}

/** The level read in the words of tab `at` of its cases (work.js caseViews), or as it is without cases. */
export const inView = (level, at = 0) => (level.views?.[at] ? { ...level, notation: level.views[at].notation } : level)

export function declaration(level) {
  // One judge for each tab: the same checks, said in that tab's words.
  const judges = new Map()
  const judgeAt = (at) => {
    if (!judges.has(at)) judges.set(at, checkDeclaration(inView(level, at)))
    return judges.get(at)
  }
  return {
    // A declaration starts with one empty derivable situation; the player may take it away, leaving none.
    initial: (saved) => saved?.rules ?? [blankRule()],
    keep: (rules) => ({ rules }),
    judge: Object.assign((rules, at = 0) => judgeAt(at)(rules), { checks: judgeAt(0).checks }),
    tabs: level.views?.map(({ label }) => ({ label })),
    rows: (rules, change, scope, at = 0) => declarationValues(inView(level, at), rules, change, scope),
    lines: (rules, read, at = 0) => problemsOf(level, rules).length ? [] : ruleLines(inView(level, at), linesOf(rules), read),
    passed: T('这份声明符合需求。'),
    completion: declarationResult,
  }
}

export function definition(level) {
  const term = (text) => sayTerm(parseSide(text), level.notation)
  const condition = (text) => say(parseS(text), level.notation)
  const chips = level.rows.map((row) => termChips(row.choices.map(parseSide), level.notation))
  const language = sentenceLanguage(level.notation, 'term')
  const judge = checkDefine(level)
  return {
    initial: (saved) => Array.isArray(saved) && saved.length === level.rows.length ? saved : level.rows.map(() => null),
    keep: (sides) => sides,
    judge: (sides) => judge(sides.map((side) => complete(side) ? showTerm(side) : '')),
    rows: (sides, change, scope) => ({
      wide: true,
      rows: level.rows.map((row, k) => ({
        name: term(row.lhs), equation: true, when: row.when ? condition(row.when) : null,
        slots: [{ text: complete(sides[k]) ? term(showTerm(sides[k])) : null }],
      })),
      editor: {
        slot: (k) => ({
          title: term(level.rows[k].lhs), equation: true,
          tree: sides[k], onChange: (tree) => change(changeAt(sides, k, () => tree)), chips: chips[k], language, scope: `${scope}:${k}`,
        }),
      },
      blank,
    }),
    passed: T('每个值都正确，每次递归调用的参数都更小，因此这条定义必定终止。'),
  }
}
