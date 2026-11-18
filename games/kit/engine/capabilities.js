import { CODE_NAME, fullName } from './object-name.js'
import { mapSchemaChildren } from './schema-shapes.js'

const PRIMITIVE_VALUE_TYPES = Object.fromEntries(
  ['number', 'boolean', 'string', 'list', 'any'].map(name => [`kernel/${name}`, {}]),
)
export const builtinCapabilityKinds = {
  valueType: { studio: { order: 2, label: { zh: '值类型', en: 'Value types' } } },
  play: { studio: { order: 5, label: { zh: '玩法', en: 'Plays' } } },
  language: { studio: { order: 9, label: { zh: '语言', en: 'Languages' } } },
}

export function qualifyItems(id, items) {
  const entries = Object.entries(items).map(([name, value]) => [fullName(id, name), value])
  const result = Object.fromEntries(entries)
  if (Object.keys(result).length !== entries.length) throw new Error(`${id}: duplicate qualified capability name`)
  return result
}

/** Qualify explicit schema identities and the literal bounds of typed references. */
export function qualifyVocabulary(id, raw) {
  const schema = (value) => {
    if (!value || typeof value !== 'object') return value
    const out = mapSchemaChildren(value, schema)
    if (out.type === 'shape') out.name = fullName(id, out.name)
    if (typeof out.shape === 'string') out.shape = fullName(id, out.shape)
    if (out.type === 'syntax') out.lang = fullName(id, out.lang)
    for (const key of ['params', 'test', 'stage', 'case']) if (out[key]) out[key] = schema(out[key])
    if (out.type === 'ref' && out.values) out.values = out.values.map(name => fullName(id, name))
    return out
  }
  const items = values => qualifyItems(id, Object.fromEntries(Object.entries(values).map(([name, item]) => [name, schema(item)])))
  return { ...raw, version: 1, kinds: Object.fromEntries(Object.entries(raw.kinds).map(([kind, values]) => [kind, items(values)])), shapes: items(raw.shapes ?? {}), game: schema(raw.game), level: schema(raw.level), languages: qualifyItems(id, raw.languages ?? {}) }
}

/** Each assembly owns its capability kinds and data and implementation tables. */
export function createCapabilityRegistry(definitions = {}) {
  const kinds = { ...builtinCapabilityKinds, ...definitions }
  const tables = Object.assign(Object.create(null), { valueType: { ...PRIMITIVE_VALUE_TYPES } })
  const implementations = Object.create(null)
  const schemas = Object.create(null), languages = Object.create(null)
  return {
    definitions: kinds, tables, kinds: tables, implementations, schemas, languages, meanings: [],
    kind(_name, meaning) { this.meanings.push(meaning) },
    add(kind, name, value) {
      if (!CODE_NAME.test(name)) throw new Error(`invalid capability name ${name}`)
      const table = tables[kind] ??= Object.create(null)
      if (Object.hasOwn(table, name)) throw new Error(`duplicate ${kind} ${name}`)
      table[name] = value
    },
    implement(kind, name, value, side) {
      if (!Object.hasOwn(tables[kind] ?? {}, name)) throw new Error(`undeclared ${kind} ${name}`)
      const rule = kinds[kind]?.implementation
      if (!rule || rule.side !== side) throw new Error(`${kind} ${name} has no ${side} implementation contract`)
      assertCapabilityImplementation(kind, name, value, rule)
      const table = implementations[kind] ??= Object.create(null)
      if (Object.hasOwn(table, name)) throw new Error(`duplicate ${kind} implementation ${name}`)
      table[name] = value
    },
    vocabulary(id, vocabulary) {
      if (schemas[id]) throw new Error(`duplicate module ${id}`)
      schemas[id] = { game: vocabulary.game, level: vocabulary.level }
      for (const [kind, items] of Object.entries(vocabulary.kinds)) {
        tables[kind] ??= Object.create(null)
        for (const [name, item] of Object.entries(items)) this.add(kind, name, item)
      }
      for (const [name, item] of Object.entries(vocabulary.languages ?? {})) {
        this.add('language', name, item)
        languages[name] = item
      }
    },
  }
}

export function assertCapabilityImplementation(kind, name, value, rule) {
  if (rule.methods?.some(method => typeof value?.[method] !== 'function')) throw new Error(`${kind} ${name} needs implementation methods ${rule.methods.join(', ')}`)
  if (rule.side === 'view' && (typeof value !== 'string' || value !== `${name.split('/')[0]}/view`)) throw new Error(`${kind} ${name} needs its package view entry`)
}

/** Compile package declarations before the schema consumes any of the items. */
export function withCapabilityDeclarations(vocabulary, layers, { checkImplementations = false } = {}) {
  const definitions = { ...builtinCapabilityKinds }
  for (const { id, capabilityDeclarations = {} } of layers) for (const [file, declaration] of Object.entries(capabilityDeclarations)) {
    const { name, studio, implementation, items = {} } = declaration
    if (!/^[A-Za-z][\w-]*$/.test(file) || (name !== file && name !== `${id}/${file}`)) throw new Error(`${id}/capabilities/${file}: invalid capability kind ${name}`)
    if (Object.hasOwn(definitions, name)) throw new Error(`duplicate capability kind ${name}`)
    if (!studio?.label?.en || !studio.label.zh || (studio.order !== undefined && !Number.isFinite(studio.order))) throw new Error(`${name}: capability kind needs Studio labels`)
    if (implementation && (!['core', 'view'].includes(implementation.side) || (implementation.methods !== undefined && (!Array.isArray(implementation.methods) || !implementation.methods.every(method => typeof method === 'string'))))) throw new Error(`${name}: invalid capability implementation contract`)
    definitions[name] = { ...declaration, items: qualifyItems(id, items), owner: id }
  }
  const registry = createCapabilityRegistry(definitions)
  for (const [kind, items] of Object.entries(vocabulary.capabilities ?? {})) for (const [name, item] of Object.entries(items)) {
    if (kind === 'valueType' && Object.hasOwn(PRIMITIVE_VALUE_TYPES, name)) continue
    registry.add(kind, name, item)
  }
  for (const [kind, { items }] of Object.entries(definitions)) for (const [name, item] of Object.entries(items ?? {})) registry.add(kind, name, item)
  if (checkImplementations) {
    const owners = new Map(layers.map(layer => [layer.id, layer]))
    for (const [kind, items] of Object.entries(registry.tables)) {
      const rule = definitions[kind]?.implementation
      if (!rule) continue
      for (const name of Object.keys(items)) {
        const owner = owners.get(name.split('/')[0])
        const entry = owner?.capabilityImplementations?.[kind]?.[name]
        const value = rule.side === 'view' ? (owner?.hasView ? `${owner.id}/view` : undefined) : entry?.value
        if (rule.side === 'core' && entry?.side !== 'core') throw new Error(`${kind} ${name} needs a core implementation`)
        assertCapabilityImplementation(kind, name, value, rule)
      }
    }
  }
  return { ...vocabulary, capabilityKinds: definitions, capabilities: registry.tables, kinds: { ...vocabulary.kinds, ...registry.tables } }
}

// Runtime implementations share the same qualified names as their declarations.
export const registeredOperations = Object.create(null)
export const registeredValueTypes = Object.assign(Object.create(null), PRIMITIVE_VALUE_TYPES)
