import { find } from './schema.js'
import { getAt, setAt } from './ops/edit.js'
import { isLanguageCode, isText, isTextKey, textEntries, textKey, withTextKey } from './i18n.js'

export const textReference = (key) => `@${key}`
export const referenceKey = (value) => typeof value === 'string' && value.startsWith('@') && isTextKey(value.slice(1)) ? value.slice(1) : undefined

function mapTree(value, visit) {
  const mapped = visit(value)
  if (mapped !== value) return mapped
  if (Array.isArray(value)) return value.map((child) => mapTree(child, visit))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, mapTree(child, visit)]))
  return value
}

/** Source projection for configuration values and Studio's JSON inspector. */
export const sourceValue = (value, namespace) => mapTree(value, (child) => {
  const key = textKey(child)
  return key && isText(child) ? textReference(namespace && key.startsWith(`${namespace}/`) ? key.slice(namespace.length + 1) : key) : child
})

export const resolveReferences = (value, resolveKey) => mapTree(value, (child) => {
  if (child && typeof child === 'object' && Object.hasOwn(child, '$key')) throw new Error('Use an @key catalog reference for configuration text')
  const key = referenceKey(child)
  return key ? resolveKey(key) : child
})

/** Keep every translation when cloning content, with identities assigned to the new fields on save. */
export const copyWithoutTextKeys = (value) => mapTree(value, (child) => textKey(child) && isText(child) ? Object.fromEntries(textEntries(child)) : child)

/** Compile one scope's flat locale files into a reader for its configuration values. */
export function catalogReader(catalogs, scope = 'i18n', { allowMissing = false } = {}) {
  const byKey = new Map()
  for (const [lang, entries] of Object.entries(catalogs)) {
    if (!isLanguageCode(lang) || !entries || typeof entries !== 'object' || Array.isArray(entries)) {
      throw new Error(`${scope}/${lang}.json: expected a language file containing an object`)
    }
    for (const [key, text] of Object.entries(entries)) {
      if (key === 'ui' && text && typeof text === 'object' && !Array.isArray(text)) continue
      if (!isTextKey(key) || typeof text !== 'string') throw new Error(`${scope}/${lang}.json: invalid text entry ${key}`)
      if (!byKey.has(key)) byKey.set(key, {})
      byKey.get(key)[lang] = text
    }
  }
  return (value, file = scope, schema = null, vocabulary) => {
    const resolve = (key) => {
      const text = byKey.get(key)
      if (!text && allowMissing) return withTextKey({ en: '' }, key)
      if (!text) throw new Error(`${file}: ${textReference(key)} has no entry in ${scope}`)
      return withTextKey(text, key)
    }
    if (!schema) return resolveReferences(value, resolve)
    let resolved = value
    for (const { path } of find(schema, value, 'text', { vocabulary })) {
      const text = getAt(value, path)
      if (text && typeof text === 'object' && Object.hasOwn(text, '$key')) throw new Error('Use an @key catalog reference for configuration text')
      const key = referenceKey(text)
      if (key) resolved = path.length ? setAt(resolved, path, resolve(key)) : resolve(key)
    }
    return resolved
  }
}


/**
 * Resolve nested annotations without treating the schema itself as content data. A reference is looked up when it is
 * met (a namespaced key also finds the layer's own unqualified entry), so reading one declaration costs what it
 * references, not a pass over the whole catalog; the catalogs themselves are validated where content reads them.
 */
export function declarationReader(catalogs, namespace = '') {
  const qualify = key => namespace && !key.includes('/') ? `${namespace}/${key}` : key
  const own = namespace ? `${namespace}/` : null
  const lookup = (key) => {
    const text = {}
    for (const [lang, entries] of Object.entries(catalogs)) {
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue
      const local = own && key.startsWith(own) ? key.slice(own.length) : null
      const found = Object.hasOwn(entries, key) ? entries[key] : local !== null && !local.includes('/') && local !== 'ui' && Object.hasOwn(entries, local) ? entries[local] : undefined
      if (typeof found === 'string') text[lang] = found
    }
    if (!Object.keys(text).length) throw new Error(`declaration: ${textReference(key)} has no entry in i18n`)
    return withTextKey(text, key)
  }
  return value => mapTree(value, child => {
    const key = textKey(child)
    if (key) return withTextKey(child, qualify(key))
    const ref = referenceKey(child)
    if (!ref) return child
    return lookup(qualify(ref))
  })
}
