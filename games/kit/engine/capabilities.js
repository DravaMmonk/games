import { CODE_NAME } from './object-name.js'
// Modules contribute closed, qualified capabilities. Packages only refer to these names.
const BUILTIN_CAPABILITY_KINDS = ['valueType', 'operation', 'primitive', 'board', 'display', 'language']

const capabilityName = (id, name) => name.includes('/') ? name : `${id}/${name}`
export const qualifyItems = (id, items) => Object.fromEntries(Object.entries(items).map(([name, value]) => [capabilityName(id, name), value]))

/** Qualify the names declared by a module, including typed schema references and discriminators. */
export function qualifyVocabulary(id, raw) {
  const discriminators = { kind: 'kind', mode: 'mode', scene: 'scene', world: 'world', want: 'want' }
  const declared = (kind, name) => Boolean(raw.kinds[kind]?.[name])
  const schema = (value, field) => {
    if (!value || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map((v) => schema(v))
    const out = { ...value }
    if (out.type === 'syntax') out.lang = capabilityName(id, out.lang)
    if (out.fields) out.fields = Object.fromEntries(Object.entries(out.fields).map(([key, s]) => [key, schema(s, key)]))
    if (out.of) out.of = schema(out.of)
    if (out.params) out.params = schema(out.params)
    if (out.key) out.key = schema(out.key)
    if (out.cases) out.cases = Object.fromEntries(Object.entries(out.cases).map(([key, s]) => [discriminators[out.field] && declared(discriminators[out.field], key) ? capabilityName(id, key) : key, schema(s)]))
    if (out.type === 'oneOf' && discriminators[field]) out.values = out.values.map((v) => declared(discriminators[field], v) ? capabilityName(id, v) : v)
    return out
  }
  return { ...raw, version: 1, kinds: Object.fromEntries(Object.entries(raw.kinds).map(([kind, items]) => [kind, qualifyItems(id, Object.fromEntries(Object.entries(items).map(([name, item]) => [name, schema(item)])))])), game: schema(raw.game), level: schema(raw.level), languages: qualifyItems(id, raw.languages ?? {}) }
}

const registryKind = kind => ({ op: 'operation', part: 'primitive' })[kind] ?? kind

/** A registry is assembled once, and rejects ambiguous capability declarations. */
export function createCapabilityRegistry() {
  const tables = Object.assign(Object.create(null), Object.fromEntries(BUILTIN_CAPABILITY_KINDS.map(kind => [kind, Object.create(null)])))
  const kinds = Object.create(null)
  const schemas = Object.create(null)
  const languages = Object.create(null)
  const operations = Object.create(null)
  const displayLoaders = Object.create(null)
  return {
    tables, kinds, schemas, languages, operations, displayLoaders, meanings: [],
    kind(_name, meaning) { this.meanings.push(meaning) },
    add(kind, name, value) {
      if (!CODE_NAME.test(name)) throw new Error(`invalid capability name ${name}`)
      const table = tables[kind] ??= Object.create(null)
      if (Object.hasOwn(table, name)) throw new Error(`duplicate ${kind} ${name}`)
      table[name] = value
      if (kind === 'valueType') {
        (kinds.valueType ??= Object.create(null))[name] = value
      }
    },
    implementDisplays(names, load) {
      for (const name of names) {
        if (!tables.display[name]) throw new Error(`undeclared display ${name}`)
        if (displayLoaders[name]) throw new Error(`duplicate display implementation ${name}`)
        if (typeof load !== 'string' || !/^[a-z][a-z0-9-]*\/view$/.test(load)) throw new Error(`display ${name} needs a module UI entry`)
        displayLoaders[name] = load
      }
    },
    implementOperations(items) {
      for (const [name, item] of Object.entries(items)) {
        if (!tables.operation[name]) throw new Error(`undeclared operation ${name}`)
        if (operations[name]) throw new Error(`duplicate operation implementation ${name}`)
        if (typeof item.run !== 'function') throw new Error(`operation ${name} needs an implementation`)
        operations[name] = item
      }
    },
    vocabulary(id, vocabulary) {
      if (schemas[id]) throw new Error(`duplicate module ${id}`)
      schemas[id] = { game: vocabulary.game, level: vocabulary.level }
      for (const [kind, items] of Object.entries(vocabulary.kinds)) {
        const target = kinds[kind] ??= Object.create(null)
        for (const [name, item] of Object.entries(items)) {
          if (Object.hasOwn(target, name)) throw new Error(`duplicate ${kind} ${name}`)
          target[name] = item
          this.add(registryKind(kind), name, { kind, ...item })
        }
      }
      for (const [name, item] of Object.entries(vocabulary.languages ?? {})) {
        this.add('language', name, item)
        languages[name] = item
      }
    },
  }
}

// Runtime implementations share the same qualified names as their declarations.
export const registeredOperations = Object.create(null)
export const registeredValueTypes = Object.create(null)
