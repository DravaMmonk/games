// A game's glossary is its term registry. Definitions stay in body; aliases name the same entry, never a
// second explanation. This module checks data and literal references, not whether arbitrary prose is technical.
import { REF, textEntries } from 'kernel'

const texts = (value) => typeof value === 'string' ? [['', value]] : textEntries(value ?? {})
const normal = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
const plain = (s) => String(s ?? '').replace(REF, '').replace(/<[^>]*>/g, '').trim()
const problem = (rule, at, says) => ({ rule, at, says })

/** Compile canonical names and aliases. The existing body is the only explanation. */
export function termRegistry(glossary) {
  const entries = new Map()
  const names = Object.create(null)
  const failures = []
  for (const entry of glossary.entries) {
    const at = `glossary:${entry.id}`
    if (entries.has(entry.id)) failures.push(problem('term-id', at, 'duplicate entry id'))
    entries.set(entry.id, entry)
    if (!texts(entry.title).some(([, text]) => plain(text))) failures.push(problem('term-name', `${at}.title`, 'the canonical name is empty'))
    if (!(entry.body ?? []).some((p) => texts(p).some(([, text]) => plain(text)))) failures.push(problem('term-definition', `${at}.body`, 'the entry body has no explanatory text'))
    for (const [k, text] of [entry.title, ...(entry.aliases ?? [])].entries()) {
      const where = k ? `${at}.aliases[${k - 1}]` : `${at}.title`
      const entries = texts(text)
      if (k && !entries.some(([, value]) => normal(value))) failures.push(problem('term-name', where, 'an alias is empty'))
      for (const [lang, value] of entries) {
        const name = normal(value)
        if (!name) continue
        const byName = names[lang] ??= new Map()
        const previous = byName.get(name)
        if (previous && previous !== entry.id) failures.push(problem('term-name-conflict', lang ? `${where}.${lang}` : where, `“${name}” also names entry ${previous}`))
        else byName.set(name, entry.id)
      }
    }
  }
  return { entries, names, failures }
}

/**
 * places: schema-declared player texts with {at, text, level?, literal?}. before(a,b) is the course's
 * guaranteed prerequisite relation.
 */
export function termUsage(registry, places, before) {
  const failures = []
  const available = (entry, level) => !entry.at || entry.at === level || Boolean(level && before(entry.at, level))
  for (const place of places) {
    if (place.literal) {
      if (/<\/?[a-z][a-z0-9-]*-ref\b/.test(place.text)) failures.push(problem(place.literal.rule, place.at, place.literal.says))
      continue
    }
    if (/<\/?wiki-ref\b/.test(place.text.replace(REF, ''))) failures.push(problem('term-reference-format', place.at, 'malformed term reference; use a closed wiki-ref with a registered id'))
    const linked = new Set([...place.text.matchAll(REF)].filter((m) => m[1] === 'wiki').map((m) => m[2]))
    for (const id of linked) {
      const entry = registry.entries.get(id)
      if (!entry) failures.push(problem('term-reference', place.at, `the term ${id} is not registered in this game's glossary`))
      else if (!available(entry, place.level)) failures.push(problem('term-unavailable', place.at, `the explanation for ${id} opens at ${entry.at}, which is not available here`))
    }
  }
  return failures
}
