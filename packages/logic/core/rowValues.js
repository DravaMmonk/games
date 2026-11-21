import { T } from 'kernel/words'
import { showTerm } from './formula.js'
import { parseS, parseSide, ruleText } from './schematic.js'
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

export function declarationValues(level, rules, change, scope) {
  const binder = level.binder ?? 'x'
  const words = (value) => say(value, level.notation)
  const chips = premiseChips(level)
  const problems = change ? problemsOf(level, rules, chips) : []
  const withRule = (k, fn) => change(changeAt(rules, k, fn))
  return {
    className: 'lg-rule-table',
    head: { name: T("待验证结论"), goal: words(sentenceOf(level, level.target)), end: T('为真。') },
    rows: rules.map((rule, k) => ({
      name: T("可推导情形"), mark: k + 1,
      toggle: level.thing && { on: rule.binds.length > 0, label: T("任取 {binder}", {binder}), run: () => withRule(k, (r) => ({ ...r, binds: r.binds.length ? [] : [binder] })) },
      slots: rule.needs.map((need, j) => ({ text: whole(need) ? words(need) : null, bad: problems.some((p) => p.row === k && p.slot === j) })),
      end: rule.needs.length > 1 ? T('均为真。') : T('为真。'),
      empty: T('无需前提'),
      add: { label: T("给可推导情形 {k} 添加前提", {k: k + 1}), text: rule.needs.length ? null : T('添加前提'), run: () => withRule(k, (r) => ({ ...r, needs: [...r.needs, null] })) },
      drop: { label: T("删除可推导情形 {k}", {k: k + 1}), run: () => change(without(rules, k)) },
    })),
    editor: change && {
      slot: (k, j) => ({
        title: T("可推导情形 {k} 的前提", {k: k + 1}),
        tree: rules[k].needs[j], chips, language: sentenceLanguage(level.notation, 'formula', rules[k].binds), scope: `${scope}:${k}.${j}`,
        onChange: (tree) => withRule(k, (r) => ({ ...r, needs: changeAt(r.needs, j, () => tree) })),
      }),
      close: (k, j) => {
        if (rules[k]?.needs[j] === null) withRule(k, (r) => ({ ...r, needs: without(r.needs, j) }))
      },
    },
    more: { text: T("添加可推导情形"), run: () => change([...rules, blankRule()]) },
    blank,
  }
}

/** The introduction rules as entered, and the generated elimination rule. */
export function ruleLines(level, ways, read) {
  // With no derivable situation there is no intro rule, and the elim rule takes the sentence to anything (⊥).
  const text = (f) => read(say(f, level.notation))
  const { make, take } = declaredRules(level, ways, (f) => f)
  return [
    ...make.map((rule, k) => ({ name: read(T("引入规则")), mark: k + 1, text: ruleText(rule, text) })),
    { name: read(T("消去规则")), text: ruleText(take, text) },
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
    score: (rules) => ({ steps: rules.length }),
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
    score: () => null,
  }
}
