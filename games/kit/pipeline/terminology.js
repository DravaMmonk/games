// The read-only adapter from content/schema text locations to the game's term registry and course prerequisites.
import { searchable } from '../engine/ops/search.js'
import { contentSchemas } from '../engine/content.js'
import { meaningsOf } from '../engine/kind-meanings.js'

export function reviewTerminology(content, spec, vocabulary) {
  const terms = meaningsOf(contentSchemas.get(content) ?? vocabulary).find(meaning => meaning.terminology)?.terminology
  if (!terms) return { terms: [], failures: [] }
  const { termRegistry, termUsage } = terms
  const registry = termRegistry(content.glossary)
  const places = searchable(content, vocabulary, ['text']).map((p) => {
    const entry = p.entry ? content.glossary.entries.find(item => item.id === p.entry) : null
    const path = p.path.join('.')
    return {
      at: `${p.file}:${path}${p.side ? `.${p.side}` : ''}`, text: p.text,
      level: entry ? entry.at : p.level,
      literal: p.literal,
    }
  })
  const failures = termUsage(registry, places, (a, b) => spec.course.before(a, b))
  return {
    terms: [...registry.entries.values()],
    failures: [...registry.failures, ...failures],
  }
}
