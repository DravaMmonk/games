import { T } from 'kernel/words'
import { show } from './formula.js'
import { propositionsOf, sentenceOf } from './iso.js'
import { say } from './notation.js'
import { sentencePicker } from './sentenceLanguage.js'

export const DERIVABLE = [
  { value: true, label: T("可推导", {}, "audit-cells") },
  { value: false, label: T("不可推导", {}, "audit-cells") },
]
const fixed = (name) => (row) => row.fixed?.includes(name)

export function caseCells(level) {
  const read = (value) => sentenceOf(level, value)
  const build = sentencePicker(propositionsOf(level).map(read), { read, notation: level.notation, consts: level.things ?? [], text: (value) => say(read(value), level.notation) })
  const target = show(read(level.target))
  return [
    {
      // A case's situation: a set of premises, each one a premise.
      name: 'given', shape: 'tree-list', label: T("情形"), align: 'start', build,
      placeholder: T('无'), addLabel: T('添加前提'), scope: `${level.id}:case`,
      // Its premises read as a derivable situation's (rowValues.js): 「；」 between them, then 为真。 or 均为真。.
      end: (n) => (n > 1 ? T('均为真。') : T('为真。')), blank: T('未写完'),
      title: (k) => T("第 {k} 条条例的前提", {k: k + 1}),
      fixed: fixed('given'), fixedLabel: T("情形（固定）"), kept: (row) => row.keep,
      write: (row, given) => ({ ...row, given: [...(row.keep ?? []), ...given.filter((s) => !row.keep?.includes(s))] }),
    },
    {
      // What the case asks of the premises: the conclusion to derive from them.
      name: 'goal', shape: 'tree', label: T("结论"), build,
      placeholder: T("待选择"), scope: `${level.id}:goal`,
      title: (k) => T("第 {k} 条条例的结论", {k: k + 1}),
      fixed: fixed('goal'), fixedLabel: T("结论（固定）"),
      read: (row) => row.goal ?? level.target,
      write: (row, goal) => ({ ...row, goal: goal === target ? undefined : goal }),
    },
    {
      // What the case expects: whether the conclusion is derivable.
      name: 'make', shape: 'choice', label: T("预期结果"), options: DERIVABLE, placeholder: T("待选择"),
      fixed: fixed('make'), fixedLabel: T("预期结果（固定）"),
    },
  ]
}
