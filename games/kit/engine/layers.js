import { copyData } from './json-value.js'
import { collectionContribution, mergeFields } from './collections.js'
import { layerProblems } from './kind-policy.js'
// Dependency ordering, override composition and provenance shared by readers and author operations.
import { dependencyIds, validateConfig } from './semver.js'
import { tagKey, kernelTags } from './tag-identity.js'
import { kindSchemas } from './plugin-kinds.js'
import { expandNames, fullName, OBJECT_KINDS } from './names.js'
import { OBJECT_SCHEMAS } from './objects.js'
import { catalogReader, declarationReader, sourceValue } from './catalogs.js'

export const folders = { level: 'levels', tag: 'tags', relation: 'relations', chapter: 'chapters', shape: 'shapes' }
export const kindForFolder = Object.fromEntries(Object.entries(folders).map(([kind, folder]) => [folder, kind]))
export const schemaForKind = (kind, schemas = {}, value) => {
  const schema = ({ level: schemas.level, game: schemas.game, ...kindSchemas(schemas), ...Object.fromEntries(Object.entries(OBJECT_SCHEMAS).map(([folder, schema]) => [kindForFolder[folder], schema])) })[kind]
  if (!value || !schema) return schema
  if (!['tag', 'relation'].includes(kind) && !Object.values(schema.fields ?? {}).some(field => field.reference === '$kind' || field.of?.reference === '$kind')) return schema
  const reference = kind === 'relation'
    ? (value.kind === 'requires' ? 'level' : Object.values(schemas.objectKinds ?? {}).map(d => d.relations?.[value.kind]?.from).find(Boolean) ?? 'any')
    : value.kind
  const bind = s => s && { ...s, ...(s.reference?.startsWith('$') && { reference }), ...(s.of && { of: bind(s.of) }), ...(s.fields && { fields: Object.fromEntries(Object.entries(s.fields).map(([key, field]) => [key, bind(field)])) }) }
  return bind(schema)
}

/** The game must explicitly select the complete dependency closure. */
export function orderPackages(packages) {
  if (packages.some(p => p.id === 'kernel')) throw new Error('kernel is a reserved namespace')
  const byId = new Map(packages.map((p) => [p.id, p]))
  if (byId.size !== packages.length) throw new Error('duplicate package selection')
  for (const p of packages) {
    if (!p.missing) validateConfig(p.config)
  }
  const out = [], remaining = new Set(byId.keys())
  while (remaining.size) {
    const next = [...remaining].sort().find((id) => dependencyIds(byId.get(id).config).every((dep) => !remaining.has(dep)))
    if (!next) throw new Error(`circular package dependencies: ${[...remaining].sort().join(', ')}`)
    remaining.delete(next); out.push(byId.get(next))
  }
  return out
}

/** Object overrides retain omitted fields, and collections follow their own schema. */
export function applyOverride(kind, before, patch, schemas, audit, layer) {
  return mergeFields(before, patch, schemaForKind(kind, schemas, { ...before, ...patch }), audit, layer)
}

/** Visible override events in load order. Object snapshots retain @key references; i18n snapshots are literal text. */
export function visibleOverrides(content, layer = content.layerOrder?.at(-1)) {
  if (!content.layerOrder?.includes(layer)) throw new Error(`unknown layer ${layer}`)
  const visible = new Set()
  const visit = (id) => { if (visible.has(id)) return; visible.add(id); for (const dep of content.layerUses?.[id] ?? []) visit(dep) }
  visit(layer)
  return (content.overrideHistory ?? []).filter((event) => visible.has(event.layer)).sort((a, b) => content.layerOrder.indexOf(a.layer) - content.layerOrder.indexOf(b.layer)).map(copyData)
}

function contextFor(layer, layers, schemas) {
  const readerCache = new Map()
  const name = v => fullName(layer.id, v)
  const objects = Object.fromEntries([...new Set(layer.objects.map(object => object.kind))].map(kind => [kind, Object.fromEntries(layer.objects.filter(object => object.kind === kind).map(object => [object.name, object.value]))]))
  const qualify = (value, schema, context = '') => expandNames(value, layer.id, { objects, schema, vocabulary: schemas, context, resolve: name, readerCache })
  return { name, objects, qualify }
}

/** Qualify declarations before composing, so short references retain their author's namespace. */
export function composeLayers(layers, schemas) {
  layers = [...orderPackages(layers.filter((layer) => !layer.id.startsWith('@'))), ...layers.filter((layer) => layer.id.startsWith('@'))]
  const registries = Object.fromEntries([...new Set([...OBJECT_KINDS, ...Object.keys(kindSchemas(schemas)), ...layers.flatMap(layer => layer.objects.map(object => object.kind)), 'i18n'])].map((kind) => [kind, {}]))
  const sources = Object.fromEntries(Object.keys(registries).map((kind) => [kind, {}]))
  const policyProblems = []
  const collectionContributions = new Map()
  const history = [], catalogs = {}, configurations = [], qualifiedLayers = []
  const readers = new Map([...kernelTags, ...layers.flatMap(layer => (layer.tagReaders ?? []).map(reader => [tagKey(reader.member, reader.name), reader]))])
  for (const layer of layers) for (const object of layer.codeObjects ?? []) {
    if (object.kind === 'tag') continue
    registries[object.kind] ??= {}
    sources[object.kind] ??= {}
    const schema = schemaForKind(object.kind, schemas, object.value)
    const collections = {}
    policyProblems.push(...layerProblems(layer.id, object.kind, object.name, object.value, schema, schemas))
    registries[object.kind][object.name] = mergeFields(undefined, object.value, schema, collections, layer.id)
    sources[object.kind][object.name] = { declaration: layer.id, overrides: [], reader: layer.id, collections }
  }
  const identity = (kind, name, value) => kind === 'tag' ? tagKey(value.kind, name) : name
  const dependencies = new Map(layers.map((layer) => [layer.id, dependencyIds(layer.config ?? {})]))
  const depends = (a, b, seen = new Set()) => {
    if (seen.has(a)) return false
    seen.add(a)
    return (dependencies.get(a) ?? []).some((dep) => dep === b || depends(dep, b, seen))
  }
  const record = (kind, name, value, layer, override, contribution, previousValue, file) => {
    const key = identity(kind, name, value)
    const before = previousValue ?? registries[kind][key]
    const reader = kind === 'tag' ? readers.get(key) : undefined
    if (reader) sources.tag[key] ??= { declaration: null, reader: reader.reader, overrides: [] }
    if (!override && before !== undefined && !(sources[kind][key]?.declaration === undefined || sources[kind][key]?.declaration === null)) throw new Error(`duplicate ${kind} ${name}`)
    if (override) {
      sources[kind][key] ??= { declaration: null, overrides: [] }
      const collaborative = collectionContribution(contribution, schemaForKind(kind, schemas, { ...before, ...contribution }), before)
      const contributors = collectionContributions.get(`${kind}:${key}`) ?? new Set()
      for (const previous of sources[kind][key].overrides) {
        const independent = !previous.startsWith('@') && !layer.id.startsWith('@') && !depends(layer.id, previous) && !depends(previous, layer.id)
        if (independent && !(collaborative && contributors.has(previous))) throw new Error(`conflicting overrides of ${kind} ${name}: ${previous}, ${layer.id}`)
      }
      if (collaborative) contributors.add(layer.id)
      collectionContributions.set(`${kind}:${key}`, contributors)
      history.push({ kind, name, ...(kind === 'tag' && { member: value.kind }), layer: layer.id, file: sourceValue(file, layer.id), before: kind === 'i18n' ? copyData(before) : sourceValue(before), after: kind === 'i18n' ? copyData(value) : sourceValue(value) })
      sources[kind][key].overrides.push(layer.id)
    } else sources[kind][key] = { ...sources[kind][key], declaration: layer.id, overrides: [] }
    const source = sources[kind][key]
    source.collections ??= {}
    registries[kind][key] = kind === 'i18n' ? value : applyOverride(kind, before, override ? contribution : value, schemas, source.collections, layer.id)
  }
  // Text is composed first, then references resolve against the catalog visible to the whole assembly.
  const authoredText = new Map()
  for (const layer of layers) {
    const { qualify } = contextFor(layer, layers, schemas)
    const words = (text) => qualify({ en: text }, { type: 'text' }).en
    const ownText = { catalogs: {}, textOverrides: [] }
    authoredText.set(layer.id, ownText)
    for (const [lang, entries] of Object.entries(layer.catalogs ?? {})) for (const [key, text] of Object.entries(entries)) {
      if (key === 'ui') continue
      if (key.includes('/') && !key.startsWith(`${layer.id}/`)) throw new Error(`${layer.id}: declare foreign wording ${key} in overrides`)
      const qualified = words(text)
      ;(ownText.catalogs[lang] ??= {})[key] = qualified
      record('i18n', `${lang}:${fullName(layer.id, key)}`, qualified, layer, false)
    }
    for (const { namespace, lang, entries: file } of layer.textOverrides ?? []) {
      const override = { namespace, lang, entries: {} }
      ownText.textOverrides.push(override)
      for (const [key, text] of Object.entries(file)) {
        if (key.includes('/') && !key.startsWith(`${namespace}/`)) throw new Error(`${layer.id}: ${key} is outside override namespace ${namespace}`)
        const qualified = words(text)
        override.entries[key] = qualified
        record('i18n', `${lang}:${fullName(namespace, key)}`, qualified, layer, true, undefined, undefined, file)
      }
    }
  }
  for (const [name, text] of Object.entries(registries.i18n)) { const i = name.indexOf(':'); (catalogs[name.slice(0, i)] ??= {})[name.slice(i + 1)] = text }
  const readText = catalogReader(catalogs, 'i18n', { allowMissing: true })
  for (const layer of layers) {
    const { name, qualify } = contextFor(layer, layers, schemas)
    const texts = (value, schema, context = '') => readText(sourceValue(qualify(value, schema, context)), layer.id, schema, schemas)
    const object = (kind, value, before) => {
      const schema = schemaForKind(kind, schemas, { ...before, ...value })
      const qualified = qualify(value, schema)
      if (kind === 'kind' || kind === 'shape') {
        return declarationReader(catalogs, layer.id)(qualified)
      }
      return readText(sourceValue(qualified), layer.id, schema, schemas)
    }
    if (!layer.id.startsWith('@') && !layer.missing) {
      for (const key of Object.keys(layer.config)) if (!['uses', 'kernel', 'version', 'kind', 'type', 'title', 'desc'].includes(key)) throw new Error(`${layer.id}/package.json: unknown field ${key}`)
      validateConfig(layer.config)
    }
    const qualifiedLayer = { ...layer, ...authoredText.get(layer.id), config: layer.id.startsWith('@') ? texts(layer.config ?? {}, schemas.game, 'configuration') : layer.config, objects: [], overrides: [] }
    if (layer.id.startsWith('@')) {
      policyProblems.push(...layerProblems(layer.id, 'game', `${layer.id}/config`, qualifiedLayer.config, schemas.game, schemas))
      record('game', `${layer.id}/config`, qualifiedLayer.config, layer, false)
      configurations.push(Object.fromEntries(Object.entries(qualifiedLayer.config).filter(([key]) => !['version', 'kernel', 'uses', 'packages', 'kind'].includes(key))))
    }
    qualifiedLayers.push(qualifiedLayer)
    for (const { kind, name: id, value } of layer.objects) {
      if (id.includes('/') && !id.startsWith(`${layer.id}/`)) throw new Error(`${layer.id}: declare foreign object ${id} in overrides`)
      const full = fullName(layer.id, id)
      const qualified = object(kind, value)
      qualifiedLayer.objects.push({ kind, name: full, value: qualified })
      policyProblems.push(...layerProblems(layer.id, kind, full, qualified, schemaForKind(kind, schemas, qualified), schemas))
      record(kind, full, qualified, layer, false)
    }
    for (const { kind, name: id, value } of layer.overrides ?? []) {
      name(id)
      const key = identity(kind, id, value)
      const reader = kind === 'tag' ? readers.get(key) : undefined
      // A reader declares the identity. Build an empty merge base only for its first override.
      const before = registries[kind]?.[key] ?? (reader ? { kind: reader.member, values: [] } : undefined)
      qualifiedLayer.overrides.push({ kind, name: id, value: { ...(['tag', 'relation'].includes(kind) && before?.kind && { kind: before.kind }), ...object(kind, value, before) } })
      const contribution = object(kind, value, before)
      const after = applyOverride(kind, before, contribution, schemas)
      policyProblems.push(...layerProblems(layer.id, kind, id, contribution, schemaForKind(kind, schemas, { ...before, ...contribution }), schemas, true, before))
      record(kind, id, after, layer, true, contribution, before, kind === 'tag' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'kind')) : value)
    }
  }
  return { policyProblems, registries, qualifiedLayers, sources, overrideHistory: history, layerOrder: layers.map((l) => l.id), layerUses: Object.fromEntries(layers.map((l) => [l.id, l.id.startsWith('@') ? layers.filter((p) => !p.id.startsWith('@')).map((p) => p.id) : dependencyIds(l.config)])), configurations, catalogs }
}
