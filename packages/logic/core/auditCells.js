import { T } from 'kernel'
import { show } from './formula.js'
import { propositionsOf, sentenceOf } from './iso.js'
import { say } from './notation.js'
import { sentencePicker } from './sentenceLanguage.js'

export const DERIVABLE = [
  { value: true, label: T('可推导', 'Derivable') },
  { value: false, label: T('不可推导', 'Not derivable') },
]
const fixed = (name) => (row) => row.fixed?.includes(name)

export function caseCells(level) {
  const read = (value) => sentenceOf(level, value)
  const build = sentencePicker(propositionsOf(level).map(read), { read, notation: level.notation, consts: level.things ?? [], text: (value) => say(read(value), level.notation) })
  const target = show(read(level.target))
  return [
    {
      // A case's situation: a set of premises, each one a premise.
      name: 'given', shape: 'tree-list', label: T('情形', 'Situation'), align: 'start', build,
      placeholder: T('无'), addLabel: T('添加前提'), scope: `${level.id}:case`,
      title: (k) => T(`第 ${k + 1} 条条例的前提`, `A premise of test case ${k + 1}`),
      fixed: fixed('given'), fixedLabel: T('情形（固定）', 'Situation (fixed)'), kept: (row) => row.keep,
      write: (row, given) => ({ ...row, given: [...(row.keep ?? []), ...given.filter((s) => !row.keep?.includes(s))] }),
    },
    {
      // What the case asks of the premises: the conclusion to derive from them.
      name: 'goal', shape: 'tree', label: T('结论', 'Conclusion'), build,
      placeholder: T('选择结论…', 'Pick a conclusion…'), scope: `${level.id}:goal`,
      title: (k) => T(`第 ${k + 1} 条条例的结论`, `The conclusion of test case ${k + 1}`),
      fixed: fixed('goal'), fixedLabel: T('结论（固定）', 'Conclusion (fixed)'),
      read: (row) => row.goal ?? level.target,
      write: (row, goal) => ({ ...row, goal: goal === target ? undefined : goal }),
    },
    {
      // What the case expects: whether the conclusion is derivable.
      name: 'make', shape: 'choice', label: T('预期结果', 'Expected result'), options: DERIVABLE, placeholder: T('选择预期结果…', 'Pick the expected result…'),
      fixed: fixed('make'), fixedLabel: T('预期结果（固定）', 'Expected result (fixed)'),
    },
  ]
}
