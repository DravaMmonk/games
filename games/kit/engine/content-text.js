import { meaningsOf } from './kind-meanings.js'
// Allocate catalog keys at the authoring boundary. Display text is identified by schema so language-like data keys
// (for example a level placement's "id") remain ordinary configuration.
import { find } from './schema.js'
import { isLanguageNeutral, isText, textEntries, textKey, withTextKey } from './i18n.js'
import { referenceKey } from './catalogs.js'
import { getAt, setAt, showPath } from './ops/edit.js'

const segment = (value) => String(value).replace(/[^a-zA-Z0-9_-]+/g, '-') || '_'

function keyPath(value, prefix, path, vocabulary) {
  const named = meaningsOf(vocabulary).map(meaning => meaning.catalogKey?.({ prefix, path, segment })).find(Boolean)
  if (named) return named
  let parent = value
  const names = path.map((step) => {
    parent = parent[step]
    return segment(typeof step === 'number' && parent && typeof parent === 'object' && parent.id !== undefined ? parent.id : step)
  })
  return [prefix, ...names].join('.')
}

/** Add stable keys to newly authored locale maps, retaining existing keys and language-neutral literals. */
export function normalizeText(value, schema, prefix, { vocabulary, reserved = new Set(), previous, annotations = false } = {}) {
  if (value === undefined || value === previous) return value
  const fields = [...(schema ? find(schema, value, 'text', { vocabulary }) : []), ...(annotations ? declarationFields(value) : [])]
  const paths = new Set()
  const used = new Set(fields.map((field) => textKey(field.value)).filter(Boolean))
  for (const key of used) reserved.add(key)
  let result = value
  for (const field of fields) {
    const at = showPath(field.path)
    if (paths.has(at) || !isText(field.value) || textKey(field.value)) continue
    paths.add(at)
    const translations = textEntries(field.value).map(([, text]) => text)
    if (translations.length > 1 && isLanguageNeutral(translations[0]) && translations.every(text => text === translations[0])) {
      result = setAt(result, field.path, translations[0])
      continue
    }
    const oldKey = textKey(getAt(previous, field.path))
    let key = oldKey && !used.has(oldKey) ? oldKey : undefined
    if (!key) {
      const base = keyPath(value, prefix, field.path, vocabulary)
      key = base
      for (let n = 2; reserved.has(key); n++) key = `${base}.${n}`
    }
    used.add(key)
    reserved.add(key)
    result = setAt(result, field.path, withTextKey(field.value, key))
  }
  return result
}

// Schema annotations are nested inside kind, shape and capability declarations.
function declarationFields(value, path = []) {
  if (isText(value)) return [{ path, value }]
  if (!value || typeof value !== 'object') {
    const annotation = path.at(-1) === 'about' || path.at(-1) === 'label' && path.at(-2) === 'studio'
    return annotation && typeof value === 'string' && !referenceKey(value) && !isLanguageNeutral(value) ? [{ path, value: { zh: value } }] : []
  }
  return Object.entries(value).flatMap(([key, child]) => declarationFields(child, [...path, key]))
}

/** Check that each localized field in this catalog scope has its own reference. */
export function catalogTextProblems(value, schema, file, vocabulary, seen) {
  const problems = []
  for (const field of find(schema, value, 'text', { vocabulary })) {
    const at = `${file}.${showPath(field.path)}`
    const key = textKey(field.value)
    if (key) {
      if (seen.has(key)) problems.push({ at, says: `text key ${key} is already used by ${seen.get(key)}` })
      else seen.set(key, at)
    } else if (isText(field.value) || referenceKey(field.value)) {
      problems.push({ at, says: 'store localized text in an i18n file and reference its key here' })
    }
  }
  return problems
}

/** Collect each locale's flat table from resolved fields. */
export function catalogsOf(scope, ...values) {
  const locales = new Map()
  const used = new Set()
  function walk(value) {
    if (!value || typeof value !== 'object') return
    const key = textKey(value)
    if (key && isText(value)) {
      if (used.has(key)) throw new Error(`${scope}: text key ${key} is used by multiple fields`)
      used.add(key)
      for (const [lang, text] of textEntries(value)) {
        if (!locales.has(lang)) locales.set(lang, new Map())
        locales.get(lang).set(key, text)
      }
      return
    }
    Object.values(value).forEach(walk)
  }
  values.forEach(walk)
  return Object.fromEntries([...locales].sort().map(([lang, entries]) => [lang, Object.fromEntries([...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))]))
}
