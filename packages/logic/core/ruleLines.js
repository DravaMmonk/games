import { checkIso, readPremise } from './iso.js'
import { freeVars, show } from './formula.js'
import { chipsFrom, complete, missingChips, straysOf } from './formulaTree.js'
import { say } from './notation.js'
import { T } from 'kernel/words'
import { inOrder } from 'kernel'

export const blankRule = () => ({ binds: [], needs: [] })

/** The chips a premise can use on the rule table. */
export const premiseChips = (level) => chipsFrom(level.sentences.map((s) => readPremise(level, s)), { consts: level.things ?? [], notation: level.notation })

/** Rules go through the same checks whether read from content or written on the rule table. */
export function problemsOf(level, rules, chips = premiseChips(level)) {
  // No derivable situation is a declaration too: nothing introduces the sentence (⊥).
  const binder = level.binder ?? 'x'
  return rules.flatMap((rule, row) => {
    if (rule.binds.length && (!level.thing || rule.binds.length !== 1 || rule.binds[0] !== binder)) return [{ row, why: 'binder' }]
    return rule.needs.flatMap((need, slot) => {
      if (!need || !complete(need) || straysOf(need).length) return [{ row, slot, why: 'empty' }]
      if ([...freeVars(need)].some((v) => !rule.binds.includes(v) && !level.params?.includes(v))) return [{ row, slot, why: 'stray' }]
      const missing = missingChips(need, chips)
      return missing.length ? [{ row, slot, why: 'chips', missing }] : []
    })
  })
}

/** The editor stores trees. Authored rules and the derivability checks use sentences. */
export const readRuleRows = (level, lines) => lines.map((rule) => ({ binds: rule.binds, needs: rule.needs.map((need) => readPremise(level, need)) }))
export const linesOf = (rules) => rules.map((rule) => ({ binds: rule.binds, needs: rule.needs.map((need) => show(need)) }))

function problemText({ row, slot, why, missing }) {
  switch (why) {
    case 'binder': return T("可推导情形 {row} 使用了这一关未提供的任取设置。", {row: row + 1})
    case 'empty': return T("可推导情形 {row} 的第 {slot} 个前提还没写完。", {row: row + 1, slot: slot + 1})
    case 'stray': return T("可推导情形 {row} 的第 {slot} 个前提提到了没有任取的东西。", {row: row + 1, slot: slot + 1})
    case 'chips': return T("可推导情形 {row} 的第 {slot} 个前提用了这一关未提供的词：{value}。", {row: row + 1, slot: slot + 1, value: { zh: String(missing.join('、')), en: String(missing.join(', ')) }})
  }
}

/** Check that the rules can be written on this table before running the hidden derivability cases. */
export function checkDeclaration(level) {
  const chips = premiseChips(level)
  const words = (sentence) => say(readPremise(level, sentence), level.notation)
  const judge = checkIso(level, words)
  const form = (rules) => {
    const problem = problemsOf(level, rules, chips)[0]
    if (!problem) return null
    const { row, slot } = problem
    return { ...(row === undefined ? {} : { at: slot === undefined ? { row } : { row, slot } }), why: problemText(problem) }
  }
  return inOrder(form, (rules) => judge(linesOf(rules)))
}
