import { introductions } from './course.js'

/** Names, descriptions and introduction sites shared by checks and the components box. */
export function circuitPartCatalog(circuit, fixedCards = {}) {
  const primitives = [...introductions(circuit.course)].map(([part, at]) => {
    const { name, desc } = circuit.defs[part] ?? fixedCards[part]
    return { key: `part:${part}`, part, name, desc, at }
  })
  const built = [...new Set(circuit.LEVELS.flatMap(level => level.unlocks))].map(part => {
    const { name, desc } = circuit.parts[part]
    return { key: part, part, name, desc }
  })
  return { primitives, built }
}

const catalogs = new WeakMap()

/** Reuse the reference catalog across checks on one prepared course, including mixed plays. */
export function referencePartCatalog(spec) {
  if (!catalogs.has(spec)) {
    const parts = spec.specs
      ? [...new Map(spec.specs.filter(fragment => fragment.levels.length)
        .flatMap(fragment => fragment.partCatalog?.() ?? []).map(part => [part.key, part])).values()]
      : spec.partCatalog?.() ?? []
    catalogs.set(spec, parts)
  }
  return catalogs.get(spec)
}
