import { property } from 'kernel'
import { T } from 'kernel/words'
import { atom, parse } from './formula.js'
import { say } from './notation.js'
import { lettersOf, rowsOf, tautology, valueOn } from './truth.js'

export function truth(level) {
  const formulas = level.formulas.map((t) => parse(t))
  const tables = formulas.map((formula) => {
    const letters = lettersOf([formula])
    return {
      title: say(formula, level.notation),
      headers: letters.map((letter) => say(atom(letter), level.notation)),
      rows: rowsOf(letters).map((row) => ({ given: letters.map((letter) => row[letter]), value: valueOn(formula, row) })),
    }
  })
  const wants = {
    fill: tables[0].rows.map(({ value }) => value),
    valid: formulas.map(tautology),
  }
  const judge = (state) => {
    const unanswered = new Set()
    const wrong = new Set()
    const expected = wants[level.ask]
    if (!expected) {
      const hit = property((work) => Object.keys(work.tried).some((key) => {
        const [f, k] = key.split(':').map(Number)
        return tables[f].rows[k].value === (level.ask === 'sat')
      }), () => ({}))
      return { pass: !hit(state), unanswered, wrong }
    }
    const values = level.ask === 'fill' ? state.fill : state.marks
    expected.forEach((want, k) => {
      if (values[k] === undefined) unanswered.add(k)
      else if (values[k] !== want) wrong.add(k)
    })
    return { pass: unanswered.size === 0 && wrong.size === 0, unanswered, wrong }
  }
  return {
    tables, judge,
    mode: level.ask === 'fill' ? 'fill' : level.ask === 'valid' ? 'classify' : 'try',
    hit: (f, k) => level.ask !== 'fill' && level.ask !== 'valid' && tables[f].rows[k].value === (level.ask === 'sat'),
    accepted: level.ask === 'counter' ? T('已找到反例：命题在这一行为假。') : level.ask === 'sat' ? T('已找到满足赋值：命题在这一行为真。') : T('全部正确。'),
    retry: level.ask === 'counter' ? T('继续尝试，找出使命题为假的一行。') : T('继续尝试，找出使命题为真的一行。'),
    labels: {
      values: [T("假"), T("真")],
      classify: [T('不恒成立'), T('恒成立')],
      inspect: T('展开真值表'),
    },
  }
}
