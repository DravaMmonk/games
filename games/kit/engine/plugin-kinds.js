import { BUILTIN_POLICIES } from './kind-policy.js'
import { CHAPTER } from './course-schema.js'
import { declarationReader } from './catalogs.js'
// Data declarations extend an assembly, never process-wide content registries.
import { mapSchemaChildren, shapeCompiler, schemaOwner, usesNamedShapes } from './schema-shapes.js'
import { CODE_NAME } from './object-name.js'
import { S, validate, validAbout } from './schema.js'
import { mergeFields } from './collections.js'

export const BUILTIN_KIND_NAMES = ['level', 'task', 'tag', 'relation', 'kind', 'shape', 'chapter', 'game']

export const KIND_DECLARATION = S.obj({
  objectKind: S.opt(S.str({ pattern: '^[a-z][a-z0-9-]*$' })),
  folder: S.opt(S.str({ pattern: '^[a-z][a-z0-9-]*$' })),
  schema: S.opt(S.any()), extends: S.opt(S.str({ pattern: '^(?:level|task|game|[a-z][a-z0-9-]*/[a-z][a-z0-9-]*)$' })),
  caseGroups: S.opt(S.str()), fields: S.opt(S.map(S.any())), play: S.opt(S.str({ reference: 'play' })), references: S.opt(S.list(S.str())),
  relations: S.opt(S.map(S.obj({ from: S.str(), to: S.str() }))),
  declares: S.oneOf(['package', 'game']),
  overrides: S.map(S.list(S.str()), { keys: '^(package|game)$' }),
  text: S.opt(S.list(S.str())),
  studio: S.opt(S.obj({ name: S.text(), icon: S.str(), group: S.opt(S.text()) })),
})
export const objectKindNames = definitions => Object.fromEntries(Object.entries(definitions ?? {})
  .filter(([, definition]) => !definition.extends).map(([name, definition]) => [definition.objectKind ?? name, name]))
export const definitionOfKind = (definitions, kind) => definitions?.[kind] ?? definitions?.[objectKindNames(definitions)[kind]]
export const kindSchemas = schemas => ({ chapter: CHAPTER, kind: KIND_DECLARATION, shape: S.any(),
  ...Object.fromEntries(Object.entries(schemas?.objectKinds ?? {}).filter(([, d]) => !d.extends).map(([name, d]) => [d.objectKind ?? name, d.schema])) })

const extend = (schema, fields) => {
  if (schema.type === 'either') return { ...schema, of: schema.of.map(s => extend(s, fields)) }
  if (schema.type === 'by') return { ...schema, cases: Object.fromEntries(Object.entries(schema.cases).map(([k, s]) => [k, extend(s, fields)])) }
  if (schema.type !== 'obj') throw new Error('field extension needs object branches')
  for (const key of Object.keys(fields)) if (schema.fields[key]) throw new Error(`field extension cannot redefine ${key}`)
  return { ...schema, fields: { ...schema.fields, ...fields } }
}
const SCHEMA_TYPES = new Set(Object.keys(S).filter(type => !['opt', 'shape'].includes(type)))
function inspect(schema, name) {
  if (!SCHEMA_TYPES.has(schema.type)) throw new Error(`${name}: invalid field schema ${schema.type}`)
  if (Object.hasOwn(schema, 'about') && !validAbout(schema.about)) throw new Error(`${name}: about needs Chinese text and valid markup`)
  for (const key of ['fields', 'cases']) for (const [field, child] of Object.entries(schema[key] ?? {})) inspect(child, `${name}.${field}`)
  if (schema.of) (Array.isArray(schema.of) ? schema.of : [schema.of]).forEach(child => inspect(child, name))
  if (schema.key) inspect(schema.key, name)
}

/** Expand shared fields in declaration discriminator trees once, before consumers read their schemas. */
function declarationSchema(source) {
  const schema = mapSchemaChildren(source, declarationSchema)
  if (schema.type === 'by' && schema.fields) {
    const fields = schema.fields
    delete schema.fields
    schema.cases = Object.fromEntries(Object.entries(schema.cases).map(([key, branch]) => [key, extend(branch, fields)]))
  }
  return schema
}

export function withKindDeclarations(vocabulary, layers, plugin = false, { checked = false, preserveLevelFields = false } = {}) {
  const definitions = { ...vocabulary.objectKinds }, raw = {}
  for (const layer of layers) {
    const reader = declarationReader(layer.catalogs ?? {}, layer.id)
    const read = object => layer.resolved ? object.value : reader(object.value)
    for (const object of layer.objects.filter(o => o.kind === 'kind')) raw[object.name.includes('/') ? object.name : `${layer.id}/${object.name}`] = read(object)
    for (const object of (layer.overrides ?? []).filter(o => o.kind === 'kind')) {
      if (!raw[object.name]) continue
      raw[object.name] = mergeFields(raw[object.name], read(object), KIND_DECLARATION)
    }
  }
  const shapeDeclarations = { ...vocabulary.shapes }
  const owners = new Map(layers.map(layer => [layer.id, layer.config?.uses]))
  for (const layer of layers) for (const object of layer.objects.filter(object => object.kind === 'shape')) {
    const name = object.name.includes('/') ? object.name : `${layer.id}/${object.name}`
    if (!CODE_NAME.test(name) || schemaOwner(name) !== layer.id || Object.hasOwn(shapeDeclarations, name)) throw new Error(`invalid or duplicate schema shape ${name}`)
    shapeDeclarations[name] = layer.resolved ? object.value : declarationReader(layer.catalogs ?? {}, layer.id)(object.value)
  }
  const compiler = shapeCompiler(shapeDeclarations, vocabulary, (owner, name) => {
    if (!checked && owner !== schemaOwner(name) && !owners.get(owner)?.[schemaOwner(name)]) throw new Error(`${owner}: schema shape ${name} requires a declared package dependency`)
  })
  const shapes = Object.fromEntries(Object.keys(shapeDeclarations).map(name => {
    const schema = compiler.resolve(name)
    inspect(schema, name)
    return [name, declarationSchema(schema)]
  }))
  const scoped = new Set()
  const taskDefinitions = []
  for (const [name, rawDefinition] of Object.entries(raw)) {
    if (Object.hasOwn(definitions, name)) delete definitions[name]
    const d = rawDefinition.extends ? rawDefinition : { folder: name.split('/').at(-1), ...rawDefinition }
    const errors = validate(KIND_DECLARATION, d)
    if (errors.length) throw new Error(`${name}: ${JSON.stringify(errors)}`)
    if (d.play && d.extends !== 'task' || d.caseGroups && !d.play) throw new Error(`${name}: play scopes a task extension`)
    if (d.play) {
      if (schemaOwner(d.play) !== schemaOwner(name)) throw new Error(`${name}: task schema must be declared by ${schemaOwner(d.play)}`)
      if (scoped.has(d.play)) throw new Error(`${d.play}: duplicate task schema`)
      scoped.add(d.play)
    }
    if (d.extends ? !d.fields || d.folder || d.schema && !d.play : !d.schema || !d.folder || d.fields) throw new Error(`${name}: declare folder + schema, or extends + fields`)
    if (!d.extends && Object.entries(definitions).some(([otherName, other]) => other.folder === d.folder && other.declares === d.declares && otherName.split('/')[0] === name.split('/')[0])) throw new Error(`${name}: duplicate object folder ${d.folder}`)
    if (!d.extends && ['levels', 'tasks', 'tags', 'relations', 'chapters', 'kinds', 'shapes', 'capabilities', 'core', 'view', 'i18n', 'overrides'].includes(d.folder)) throw new Error(`${name}: reserved object folder ${d.folder}`)
    if (d.objectKind && (d.extends || BUILTIN_KIND_NAMES.includes(d.objectKind) || Object.hasOwn(objectKindNames(definitions), d.objectKind))) throw new Error(`${name}: duplicate or invalid object kind ${d.objectKind}`)
    const owner = schemaOwner(name)
    const compiled = group => {
      const resolve = schema => {
        const result = compiler.compile(schema, owner, group)
        inspect(result, name)
        return declarationSchema(result)
      }
      return { ...d, ...(d.schema && { schema: resolve(d.schema) }), ...(d.fields && { fields: Object.fromEntries(Object.entries(d.fields).map(([key, field]) => [key, resolve(field)])) }) }
    }
    const definition = compiled(null)
    if (d.play) {
      const groups = d.caseGroups ? [...new Set(Object.keys(vocabulary.kinds[d.caseGroups] ?? {}).map(schemaOwner))] : [owner]
      for (const group of groups) taskDefinitions.push({ group, declaration: d.caseGroups ? compiled(group) : definition })
    }
    for (const path of d.text ?? []) {
      let field = definition.schema
      for (const key of path.split('.')) field = key === '*' ? field?.of : field?.fields?.[key]
      if (!field) throw new Error(`${name}: unknown text field ${path}`)
      Object.assign(field, { type: 'text' })
    }
    definitions[name] = definition
  }
  for (const name of Object.keys(raw)) {
    const definition = definitions[name]
    const target = definition.extends
    if (!target || ['level', 'task', 'game'].includes(target)) continue
    if (!definitions[target]?.schema || definitions[target].extends) throw new Error(`${name}: unknown object type ${target}`)
    const owner = name.split('/')[0]
    const layer = layers.find(layer => layer.id === owner)
    if (target.split('/')[0] !== owner && !layer?.config?.uses?.[target.split('/')[0]] && !layer?.resolved && !checked) {
      throw new Error(`${name}: ${target} requires a declared package dependency`)
    }
    definitions[target] = { ...definitions[target], schema: extend(definitions[target].schema, definition.fields) }
  }
  let game = vocabulary.game
  for (const d of Object.entries(definitions).filter(([name, d]) => d.extends === 'game' && !vocabulary.objectKinds?.[name]).map(([, d]) => d)) game = extend(game, d.fields)
  let level = vocabulary.level
  if (plugin) {
    const task = S.obj({ id: S.task(), step: S.opt(S.text()), brief: S.text(), play: S.str({ reference: 'play' }), after: S.opt(S.text()) })
    const generic = S.obj({ title: S.text(), intro: S.opt(S.list(S.obj({ t: S.text() }))), after: S.opt(S.text()), requires: S.opt(S.list(S.level())), tasks: S.list(task, { min: 1 }) })
    if (!level) level = generic
    else level = S.obj({ ...generic.fields, ...level.fields, tasks: S.list(S.either(level.fields.tasks.of, task), { min: 1 }) })
  }
  const extensions = Object.keys(raw).map(name => definitions[name]).filter(d => d.extends === 'level' || d.extends === 'task')
  const extendLevel = (schema, fields) => extend(schema, preserveLevelFields && schema.fields ? Object.fromEntries(Object.entries(fields).filter(([key]) => !schema.fields[key])) : fields)
  for (const d of extensions.filter(d => !d.play)) {
    if (d.extends === 'level') level = extendLevel(level, d.fields)
    else {
      const tasks = s => s.type === 'either' ? { ...s, of: s.of.map(tasks) } : !s.fields.tasks ? s : { ...s, fields: { ...s.fields, tasks: { ...s.fields.tasks, of: extendLevel(s.fields.tasks.of, d.fields) } } }
      level = tasks(level)
    }
  }
  // Scoped task fields form their own play branch, so unrelated plays may use the same field name.
  // Keep case diagnostics in the declaring layers’ order.
  const order = [...owners.keys()]
  if (preserveLevelFields) taskDefinitions.length = 0
  taskDefinitions.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
  for (const { declaration: d } of taskDefinitions) {
    const tasks = s => {
      if (s.type === 'either') return { ...s, of: s.of.map(tasks) }
      if (!s.fields.tasks) return s
      const shape = s.fields.tasks.of
      const alternatives = schema => schema.type === 'either' ? schema.of.flatMap(alternatives) : [schema]
      const branches = alternatives(shape)
      const generic = branches.find(branch => branch.fields?.play?.type === 'str')
      if (!generic) throw new Error(`${d.play}: task extension needs a generic play task`)
      const base = { ...generic.fields, play: S.oneOf([d.play], { reference: 'play' }) }
      const own = d.schema ? extend(extend(d.schema, d.fields), base) : extend({ ...generic, fields: base }, d.fields)
      return { ...s, fields: { ...s.fields, tasks: { ...s.fields.tasks, of: S.either(...branches, own) } } }
    }
    level = tasks(level)
  }

  if (taskDefinitions.length) {
    const plays = taskDefinitions.map(({ declaration }) => declaration.play)
    const exclude = schema => {
      if (schema.type === 'either') return { ...schema, of: schema.of.map(exclude) }
      if (schema.fields?.play?.type === 'str') return { ...schema, fields: { ...schema.fields, play: { ...schema.fields.play, pattern: `^(?!(?:${plays.join('|')})$).+` } } }
      if (!schema.fields?.tasks) return schema
      return { ...schema, fields: { ...schema.fields, tasks: { ...schema.fields.tasks, of: exclude(schema.fields.tasks.of) } } }
    }
    level = exclude(level)
  }

  const compileItems = tables => Object.fromEntries(Object.entries(tables ?? {}).map(([kind, items]) => [kind,
    Object.fromEntries(Object.entries(items).map(([name, item]) => {
      const schemas = ['params', 'test', 'case', 'stage'].filter(key => usesNamedShapes(item[key]))
      return [name, schemas.length ? { ...item, ...Object.fromEntries(schemas.map(key => [key, declarationSchema(compiler.compile(item[key], schemaOwner(name)))])) } : item]
    })),
  ]))
  return { ...vocabulary, game, level, shapes, shapeDeclarations, kinds: compileItems(vocabulary.kinds), capabilities: compileItems(vocabulary.capabilities), kindPolicies: { ...BUILTIN_POLICIES, ...Object.fromEntries(Object.entries(objectKindNames(definitions)).map(([kind, name]) => [kind, definitions[name]])) }, objectKinds: definitions }
}

/** Reconstruct the authored declaration layers in their original dependency order. */
export function schemaLayers(order, declarations, extra = {}) {
  return order.map(id => ({
    id, ...extra,
    objects: Object.entries(declarations).flatMap(([kind, values]) => Object.entries(values ?? {})
      .filter(([name]) => schemaOwner(name) === id)
      .map(([name, value]) => ({ kind, name, value }))),
  }))
}

/** A namespaced kind owns its folder in its own layer. Shared kinds are available in other layers. */
export function objectFoldersFor(namespace, definitions, scope = namespace.startsWith('@') ? 'game' : 'package') {
  const groups = new Map()
  for (const [kind, definition] of Object.entries(definitions)) {
    if (definition.extends || definition.declares !== scope) continue
    const candidates = groups.get(definition.folder) ?? []
    candidates.push(kind)
    groups.set(definition.folder, candidates)
  }
  return Object.fromEntries([...groups].flatMap(([folder, candidates]) => {
    const owned = candidates.find(kind => kind.startsWith(`${namespace}/`))
    const kind = owned ?? (candidates.length === 1 ? candidates[0] : null)
    return kind ? [[definitions[kind].objectKind ?? kind, folder]] : []
  }))
}
