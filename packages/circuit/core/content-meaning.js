import circuitModule from './mechanism/module.js'
import { contentSchemas, createCapabilityRegistry, registeredOperations, registeredValueTypes } from 'kernel'
let capabilityRegistry
import { circuitTools } from './author-tools.js'
import { availabilityRecords, circuitReports } from './baseline.js'
import { dependencies, dot, mermaid } from './dependencies.js'
import { boardSvg } from './board/svg.js'
import { specProblems, validateProblems } from './contracts.js'
import { circuitOperations } from './author-operations.js'
import { S, parsePath } from 'kernel'
import { firstText, isLanguageNeutral } from 'kernel'
import { readWorkSet } from './course-model.js'
import { implementationProblems } from './parts/dependencies.js'
import { taskIdsOf } from 'kernel'
import { partProblems, withParts } from './parts/define.js'
import { shapeAt } from 'kernel'
import { mapBlueprintNames } from './board/text.js'
import { progressFieldsProblems } from './progress-fields.js'
import { primitiveParts } from './primitive-parts.js'
import { partFileSchema } from './parts/schema.js'

// Presentation-only part fields are validated as objects and do not affect board checks or saved work.
function puzzleParts(parts, vocabulary) {
  const schema = partFileSchema(vocabulary).fields.parts.of
  return Object.fromEntries(Object.entries(parts).map(([id, part]) => {
    const fields = shapeAt(schema, part, [], { vocabulary })?.fields
    return [id, Object.fromEntries(Object.entries(part).filter(([key]) => fields?.[key]?.section !== 'read'))]
  }))
}

/** Package-owned qualification of references embedded in circuit works and grant fields. */
export function circuitNames({ name, vocabulary, objects = {}, parts = new Set(), partRules = new Set(), context }) {
  parts = new Set([...parts, ...Object.keys(objects['circuit/part'] ?? {}).map(id => id.split('/').at(-1))])
  partRules = new Set([...partRules, ...(vocabulary?.meanings ?? []).flatMap(meaning => meaning.blueprintRules?.({ objects }) ?? [])])
  const part = value => {
    if (typeof value !== 'string') return value
    if (value.includes('/')) return name(value)
    return parts.has(value.split(/[.=]/)[0]) || !vocabulary?.kinds.primitive?.[value.split(/[.=]/)[0]] ? name(value) : value
  }
  const rule = value => typeof value === 'string' && (value.includes('/') || partRules.has(value.split('.')[0])) ? name(value) : value
  return {
    link(kind, target) {
      if (kind !== 'part' || !/^(part|lemma):/.test(target)) return undefined
      const colon = target.indexOf(':')
      return `${target.slice(0, colon + 1)}${part(target.slice(colon + 1))}`
    },
    rewrite({ value, schema, key, object }) {
      if (schema?.reference === 'circuit/part' || ['primitive', 'unlock', 'circuit/part'].includes(schema?.kind) && ['ref', 'name'].includes(schema?.type)) return { value: part(value) }
      if (schema?.type === 'board' || schema?.view === 'board') return { value: Array.isArray(value) && value.every(line => typeof line === 'string') ? mapBlueprintNames(value, type => type.includes('/') || parts.has(type) ? name(type) : type, rule) : value }
      if (['rules', 'using', 'simp'].includes(key) && Array.isArray(value)) return { value: value.map(rule) }
      if (key === 'tray') return { value: Array.isArray(value) ? value.map(name) : name(value) }
      if (key === 'open' && context === 'configuration') return { value: Object.fromEntries(Object.entries(value).map(([rule, items]) => [rule, items.map(entry => ({ ...entry, part: part(entry.part), level: name(entry.level) }))])) }
      if (key === 'reference' && vocabulary?.level?.fields?.tasks) return { schema: { type: 'obj', fields: { ...vocabulary.level.fields, ...shapeAt(vocabulary.level.fields.tasks.of, value, [], { vocabulary })?.fields, solution: { type: 'board' } } } }
      void object
    },
  }
}

export const partMeaning = {
  capability: 'primitive',
  studio: {
    schemas: { partDefs: partFileSchema },
    relations: { replaces: 'circuit/part' },
    collections: { 'circuit/tray': { accepts: kind => kind === 'circuit/part', members: value => [...(value.values ?? []), ...(value.menus ?? []).flatMap(menu => menu.values ?? [])], types: () => ['circuit/part'] } },
    owners: content => Object.keys(content.partDefs?.parts ?? {}).map(part => [part, part]),
  },
  tools: circuitTools,
  catalogKey: ({ prefix, path: [field, id, ...rest], segment }) => prefix === 'parts' && field === 'parts' ? ['part', id, ...rest].map(segment).join('.') : null,
  baselineCourse: ({ fragment }) => ({ publications: fragment.course.publications, stages: fragment.course.stages }),
  baselineStructure: ({ content }) => ({ parts: content.partDefs, trays: content.trays }),
  blueprintPrimitives: content => ({ values: primitiveParts(content), path: 'overrides/circuit/tags/circuit/part/primitives.json' }),
  baselineRecords: availabilityRecords,
  baselineReports: circuitReports,
  search({ content, texts, vocabulary }) {
    for (const [id, part] of Object.entries(content.partDefs?.parts ?? {})) texts(part, partFileSchema(vocabulary).fields.parts.of, { file: `parts/${id}.json`, in: 'parts', annotations: path => path.at(-1) === 'desc' ? { literal: { rule: 'part-description-reference', says: 'component descriptions are plain text; write names without reference markup' } } : {} }, ['parts', id])
  },
  dependencyGraph: ({ course, dot: asDot, levels }) => (asDot ? dot : mermaid)(dependencies(course), { levels }),
  renderWork: ({ text, title }) => boardSvg(text, { title }),
  renderFields: ({ value }) => value.adds ? [`brings in: ${value.adds.join(', ')}`] : [],
  namesForTool({ content, game }) {
    return { parts: game ? (game.parts?.all ?? []).map(part => ({ key: part.key, name: part.name, part: part.part ?? (part.key.startsWith('part:') ? part.key.slice(5) : part.key), at: part.at?.[0] ?? game.levels.find(level => (level.unlocks ?? []).includes(part.key))?.id ?? null })) : Object.entries(content.partDefs?.parts ?? {}).map(([key, part]) => ({ key: `part:${key}`, name: part.name, part: key, at: null })) }
  },
  contract: { spec: specProblems, validate: validateProblems },
  operations: circuitOperations,
  selectors: ['part'],
  textTarget({ workspace, args, vocabulary }) {
    return args.in === 'parts' ? [{ id: 'parts', value: workspace.partDefs, schema: partFileSchema(vocabulary), selector: { in: 'parts' }, set: value => { workspace.partDefs = value } }] : []
  },
  operationTargets: ({ workspace, args, vocabulary }) => {
    const schema = partFileSchema(vocabulary)
    return { part: [schema.fields.parts.of, workspace.partDefs?.parts?.[args.part]], parts: [schema, workspace.partDefs] }
  },
  sourceArguments({ args, operation, local }) {
    if (args.path !== undefined && (operation.startsWith('parts.') || args.in === 'parts')) {
      const path = parsePath(args.path)
      if (path[0] === 'parts' && path.length > 1) args.path = [path[0], local(path[1]), ...path.slice(2)]
    }
  },
  textPrefix: 'part',
  workspace(ws) {
    Object.defineProperty(ws, 'partDefs', {
      get: () => ({ parts: Object.fromEntries(ws.contentObjects['circuit/part'] ?? []) }),
      set: value => { ws.contentObjects['circuit/part'] = new Map(Object.entries(value.parts)) },
    })
  },
  textNames({ content, game, vocabulary }) {
    if (game) return { part: new Map((game.parts?.all ?? []).map(part => [part.key, String(firstText(part.name))])) }
    const names = new Map(Object.entries(content.registries['circuit/part'] ?? {}).map(([id, object]) => [id, String(firstText(object.name ?? id))]))
    for (const id of Object.keys(content.registries['circuit/part'] ?? {})) { names.set(`part:${id}`, ''); names.set(`lemma:${id}`, '') }
    for (const id of Object.keys(vocabulary.kinds.unlock ?? {})) names.set(id, '')
    return { part: names }
  },
  texts: ({ content, game }) => ({ parts: game ? (game.parts?.all ?? []).map(part => ({ key: part.key, name: part.name, desc: part.desc })) : content.partDefs?.parts }),
  readWorks: ({ content, readers }) => readWorkSet(content, readers),
  taskModule: () => 'circuit',
  runtimeIds({ content, tasks, taskModule }) {
    if (tasks.length) return tasks.some(task => !taskModule(task)) ? ['circuit'] : []
    const parts = Object.values(content.partDefs?.parts ?? content.registries?.['circuit/part'] ?? {})
    const references = parts.flatMap(part => part.inside?.map(entry => entry.reference) ?? [])
    if (references.length) return [...new Set(references.map(task => taskModule(task) ?? 'circuit'))]
    const owner = name => typeof name === 'string' && name.includes('/') ? name.split('/')[0] : null
    const types = parts.flatMap(part => [part.outputType, ...(part.inputs ?? []).map(port => port.type)])
    return [[...types.map(owner), ...parts.map(part => owner(part.family) ?? owner(part.mark))].find(id => id && id !== 'circuit' && id !== 'kernel') ?? 'circuit']
  },
  scope({ content, id, taskModule }) {
    const parts = Object.fromEntries(Object.entries(content.partDefs?.parts ?? {}).filter(([, part]) => !part.inside || part.inside.some(entry => (taskModule(entry.reference) ?? 'circuit') === id)))
    return { ...content, partDefs: { ...content.partDefs, parts } }
  },
  validationVocabulary: ({ vocabulary, content, workspace }) => withParts(vocabulary, (content ?? workspace).partDefs),
  validationNames: ({ content }) => ({ tray: new Set(Object.keys(content.registries?.['circuit/tray'] ?? {})) }),
  validate({ content, vocabulary }) {
    if (content.partDefs !== undefined) {
      const required = progressFieldsProblems(content, vocabulary)
      const parts = Object.fromEntries(Object.entries(puzzleParts(content.partDefs.parts, vocabulary)).map(([id, { stages: _stages, ...part }]) => [id, part]))
      const tasks = taskIdsOf(content.levels)
      const problems = [...required, ...partProblems({ parts }, vocabulary, { tasks })]
      return problems.length ? problems : implementationProblems(content.partDefs)
    }
    return []
  },
  type: 'circuit/part', read: value => value,
  names: circuitNames,
  vocabulary: circuitVocabulary,
  derived: ['partDefs', 'trays', 'replaces'],
  source: ({ content }) => ({ 'circuit/part': content.partDefs?.parts ?? {} }),
  assemble({ registries, relationEdges, resolve, problems, schemas }) {
    const parts = registries['circuit/part'] ?? {}
    registries['circuit/part'] = { ...schemas.kinds?.primitive, ...parts }
    const replaces = {}
    for (const { from, to } of relationEdges.replaces ?? []) (replaces[from] ??= []).push(to)
    const trays = {}
    for (const [name, tray] of Object.entries(registries['circuit/tray'] ?? {})) {
      const menus = (tray.menus ?? []).map(menu => ({ id: menu.id, title: menu.title, items: menu.values.flatMap(value => resolve(value, 'circuit/part', `trays/${name}/menus/${menu.id}`)) }))
      if (new Set(menus.map(menu => menu.id)).size !== menus.length) problems.push({ at: `trays/${name}`, says: 'duplicate menu id' })
      const direct = tray.values.flatMap(value => resolve(value, 'circuit/part', `trays/${name}`))
      trays[name] = { name: tray.title, desc: tray.desc, ...(tray.menuThreshold !== undefined && { menuThreshold: tray.menuThreshold }),
        items: [...menus.map(menu => menu.id), ...direct].map(id => menus.find(menu => menu.id === id) ?? id) }
    }
    return { partDefs: { parts }, trays, replaces }
  },
  relationProblems({ name, relation, edges, expand }) {
    if (relation.kind !== 'replaces') return []
    return edges.flatMap(edge => [
      ...(edge.from === edge.to ? [{ at: `relations/${name}`, says: 'a part cannot replace itself' }] : []),
    ])
  },
  stamp({ content, plain }) {
    const vocabulary = contentSchemas.get(content)
    const file = content.partDefs ? { parts: puzzleParts(content.partDefs.parts, vocabulary) } : null
    return plain(file, partFileSchema(vocabulary), ({ path, value }) =>
      (path.length === 3 && path[2] === 'name' && /^[A-Z]$/.test(value))
      || (path.length === 5 && ['inputs', 'outputs'].includes(path[2]) && path[4] === 'label'
        && isLanguageNeutral(value) && (/[A-Z⊥¬∀∃φ]/u.test(value) || value === 's = t') && !/^[SP]\d$/u.test(value)))
  },
}

export const trayMeaning = {
  type: 'circuit/tray', read: value => value,
  selector: 'tray',
  textParameters: { tray: S.opt(S.str()) },
  textTarget({ workspace, args, vocabulary }) {
    return args.tray === undefined ? [] : [{ id: args.tray, value: workspace.trays.get(args.tray), schema: vocabulary.objectKinds['circuit/tray'].schema, selector: { tray: args.tray }, set: value => workspace.trays.set(args.tray, value) }]
  },
  operationTargets: ({ workspace, args, vocabulary }) => ({ tray: [vocabulary.objectKinds['circuit/tray']?.schema, workspace.trays?.get(args.tray)] }),
  textPrefix: 'tray',
  workspace(ws) { Object.defineProperty(ws, 'trays', { get: () => ws.contentObjects['circuit/tray'], set: value => { ws.contentObjects['circuit/tray'] = value } }) },
  identities: ({ kind, value }) => kind === 'circuit/tray' ? (value.menus ?? []).map(menu => ({ kind: 'menu', name: menu.id, value: menu })) : [],
}

export function circuitVocabulary(vocabulary) {
  if (!capabilityRegistry) {
    capabilityRegistry = createCapabilityRegistry()
    circuitModule.register(capabilityRegistry)
    Object.assign(registeredOperations, capabilityRegistry.implementations.operation)
    Object.assign(registeredValueTypes, capabilityRegistry.tables.valueType)
  }
  const own = capabilityRegistry.schemas.circuit
  vocabulary = { ...vocabulary,
    level: vocabulary.level ?? own.level,
    kinds: { ...vocabulary.kinds, valueType: { ...registeredValueTypes, ...vocabulary.kinds.valueType } },
    game: S.obj({ ...Object.fromEntries(Object.entries(own.game.fields).map(([key, field]) => [key, S.opt(field)])), ...vocabulary.game.fields }),
  }
  const grantFields = new Set(['tray', 'adds', 'gives', 'withholds', 'opens', 'awards', 'local', 'featuredParts', 'publishes'])
  const strip = schema => {
    if (!schema) return schema
    if (schema.type === 'either') return { ...schema, of: schema.of.map(strip) }
    if (schema.type === 'by') return { ...schema, cases: Object.fromEntries(Object.entries(schema.cases).map(([name, shape]) => [name, strip(shape)])) }
    return { ...schema, fields: Object.fromEntries(Object.entries(schema.fields).filter(([key]) => !grantFields.has(key)).map(([key, field]) => [key, key === 'tasks' ? { ...field, of: strip(field.of) } : field])) }
  }
  return { ...vocabulary, level: strip(vocabulary.level) }
}
