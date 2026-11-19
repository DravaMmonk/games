import { introductions } from 'circuit'
import { ruleParts } from './machine.js'
import { ASSUMPTION_RULE, ruleText } from './schematic.js'

export function logicPartCatalog(logic) {
  const { course, defs, parts, gates, lemmas, machines, LEVELS } = logic
  const primitives = [...introductions(course)].map(([part, at]) => {
    const authored = defs[part] ?? parts[part]
    const task = !authored && LEVELS.find(({ id }) => id === at[0])?.tasks.find(({ kind }) => kind === 'logic/machine')
    const text = authored ?? (task ? ruleParts(task)[part] : null)
    const rules = part === ASSUMPTION_RULE.part ? [{ text: ruleText(ASSUMPTION_RULE) }] : undefined
    return { key: `part:${part}`, part, name: text?.name ?? part, desc: text?.desc, icon: text?.icon, rules, at }
  })
  const kept = entries => entries.filter(([part]) => !course.local(part))
    .map(([part, { name, desc }]) => ({ key: `lemma:${part}`, part, name, desc }))
  return {
    primitives,
    gates: kept(Object.entries(gates)),
    lemmas: kept(Object.entries(lemmas)),
    machines: kept([...new Set(machines)].map(part => [part, parts[part]])),
  }
}
