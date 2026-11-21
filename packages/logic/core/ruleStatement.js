import { completionResult } from 'kernel'
import { T } from 'kernel/words'
import { readPremise, sentenceOf } from './iso.js'
import { same, show } from './formula.js'
import { say } from './notation.js'
import { complete, missingChips, straysOf } from './formulaTree.js'
import { premiseChips, readRuleRows } from './ruleLines.js'
import { declarationValues } from './rowValues.js'
import { sentenceLanguage } from './sentenceLanguage.js'

const isWhole = (tree) => Boolean(tree) && complete(tree) && !straysOf(tree).length

/** A single rule on the same board as a declaration. Its preset premises are a prefix of the reference rule. */
export function ruleStatement(level) {
  const { rule, fixedPremises = 0, fixedConclusion } = level
  const premises = rule.premises.map((text) => readPremise(level, text))
  const goal = sentenceOf(level, rule.conclusion)
  const chips = premiseChips(level)
  const conclusionChips = chips.filter(({ key }) => key !== '⟹')
  const language = sentenceLanguage(level.notation)
  const name = T('结论')
  const words = (tree) => isWhole(tree) ? say(tree, level.notation) : null

  const initial = (saved) => ({
    conclusion: fixedConclusion ? goal : saved?.conclusion ?? null,
    rules: [{
      binds: [],
      needs: [...premises.slice(0, fixedPremises), ...(saved?.rules?.[0]?.needs.slice(fixedPremises) ?? [])],
    }],
  })
  const reference = {
    conclusion: goal,
    rules: readRuleRows(level, [{ binds: [], needs: rule.premises }]),
  }
  const judge = ({ conclusion, rules }) => {
    if (!isWhole(conclusion)) return { why: T('请填写结论。') }
    if (!same(conclusion, goal) || missingChips(conclusion, conclusionChips).length) return { why: T('结论和元件的输出不符。') }
    const needs = rules[0]?.needs
    if (rules.length !== 1 || needs.some((need) => !isWhole(need))) return { why: T('请写完每条前提。') }
    if (needs.some((need) => missingChips(need, chips).length)) return { why: T('前提用了这一关未提供的卡片。') }
    const written = needs.map((need) => show(need)).sort()
    const expected = premises.map((need) => show(need)).sort()
    if (written.length !== expected.length || written.some((need, k) => need !== expected[k])) {
      return { why: T('前提和元件要求的输入不符。') }
    }
    return null
  }
  return {
    initial, reference, judge,
    keep: (work) => work,
    rows: (work, change, scope) => {
      const board = declarationValues(level, work.rules, (rules) => change({ ...work, rules }), scope)
      return {
        ...board,
        rows: [
          { name, head: true, slots: [{ text: words(work.conclusion), fixed: fixedConclusion }] },
          ...board.rows,
        ],
        editor: {
          slot: (k, j) => k ? board.editor.slot(k - 1, j) : {
            title: name, tree: work.conclusion, chips: conclusionChips, language, scope: `${scope}:conclusion`,
            onChange: (conclusion) => change({ ...work, conclusion }),
          },
          close: (k, j) => { if (k) board.editor.close(k - 1, j) },
        },
      }
    },
    lines: ({ conclusion, rules }, read) => {
      const needs = rules[0].needs
      if (!isWhole(conclusion) || !needs.every(isWhole)) return []
      const given = needs.length ? `⟦${needs.map((need) => read(words(need))).join('; ')}⟧ ⟹ ` : ''
      return [{ name: read(T('规则', {}, 'written')), text: given + read(words(conclusion)) }]
    },
    passed: T('这条规则符合需求。'),
    completion: ({ rules }) => completionResult({ steps: rules[0]?.needs.length ?? 0 }),
  }
}
