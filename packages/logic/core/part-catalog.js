import { introductions } from 'circuit'

export function logicPartCatalog(logic) {
  const { course, defs, parts, gates, lemmas, machines } = logic
  const primitives = [...introductions(course)].map(([part, at]) => {
    const text = defs[part] ?? parts[part]
    return { key: `part:${part}`, part, name: text?.name ?? part, desc: text?.desc, at }
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
