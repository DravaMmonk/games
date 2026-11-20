import { referenceDependencies, stageProviders } from './requirements.js'
import { excluded, grantScope, objectsOf, policyFor, type } from './policies.js'
import { stageName, stageSchema } from './stages.js'

export { referenceDependencies, externalSupplies, stageProviders } from './requirements.js'
export { policyFor, grantScope, objectsOf } from './policies.js'
export { grantingFields } from './content-course.js'
export { stageChain, stageName, stagePatch } from './stages.js'

export const levelMarks = { optional: 'progress/optional', skippable: 'progress/skippable' }
const fields = ['adds', 'local', 'gives', 'withholds', 'opens', 'awards', 'requiresObjects']

export const progressMeaning = {
  type,
  read: value => value,
  vocabulary: vocabulary => ({ ...vocabulary, levelMarks }),
  schemaForObject: ({ kind, schema }) => excluded.has(kind) ? schema : stageSchema(schema),
  matches: (expected, actual, vocabulary) => ['progress/item', 'progress/required'].includes(expected)
    && !excluded.has(actual) && (['entry', 'section', 'chapter', 'level', 'task'].includes(actual) || Object.values(vocabulary?.objectKinds ?? {}).some(definition => definition.objectKind === actual) || Object.hasOwn(vocabulary?.objectKinds ?? {}, actual)),
  scopeReferences(layers) {
    const policies = layers.flatMap(layer => (layer.objects ?? []).filter(object => object.kind === type)
      .map(object => [object.name.includes('/') ? object.name : `${layer.id}/${object.name}`, object.value]))
    const scopes = { 'progress/item': grantScope(policies), 'progress/required': grantScope(policies, policy => policy.checks?.includes('references')) }
    return (kind, layer) => {
      const kinds = scopes[kind]?.(layer)
      return kinds?.length ? kinds : undefined
    }
  },
  studio: {
    /** The stages the studio lists under object `name` of `kind`: [{ id, index, title, path }], or null without them. */
    stages(content, kind, name) {
      if (excluded.has(kind) || !policyFor(content, kind, name).stages) return null
      const stages = objectsOf(content)[kind]?.[name]?.stages
      if (!Array.isArray(stages) || !stages.length) return null
      return stages.map((stage, index) => ({ id: stageName(name, stage.id), index: index + 1, title: stage.title ?? stage.name ?? null, path: ['stages', index] }))
    },
  },
  identities: ({ kind, value }) => excluded.has(kind) ? [] : (Array.isArray(value.stages) ? value.stages : []).filter(stage => typeof stage.id === 'string').map(stage => ({ kind, name: stage.id, value: stage })),
  names: ({ name }) => ({
    rewrite: ({ value, schema }) => schema?.stageId ? { value: name(value) } : undefined,
  }),
  dependencies(context) {
    const { content } = context
    if (!content.levels.some(level => level.requiresObjects?.length || level.tasks?.some(task => task.requiresObjects?.length))) return
    const stages = []
    for (const [kind, values] of Object.entries(objectsOf(content))) for (const [target, value] of Object.entries(values)) {
      const policy = policyFor(content, kind, target)
      if (!policy.stages || !policy.checks.has('references')) continue
      const first = value.stages?.[0]
      for (const stage of value.stages ?? []) {
        stages.push({ ...stage, item: stageName(target, stage.id) })
        if (stage === first) stages.push({ ...stage, item: target })
      }
    }
    const prerequisites = new Set(stages.map(stage => stage.item))
    const extraProviders = stageProviders(content, stages)
    const scope = grantScope(Object.entries(content.registries?.[type] ?? {}), policy => policy.checks?.includes('references'))
    return referenceDependencies(context, { introductions: true, extraProviders, itemsOf: (level, task) => [
      ...(level.requiresObjects ?? []), ...(task?.requiresObjects ?? []),
    ].filter(id => prerequisites.has(id) || scope(level.id).some(kind => policyFor(content, kind, id).checks.has('references'))) })
  },
  contentChecks({ content }) {
    const problems = []
    const fail = text => problems.push({ fail: true, text })
    const objects = objectsOf(content)
    const policies = Object.entries(content.registries?.[type] ?? {})
    const scope = grantScope(policies)
    const requiredScope = grantScope(policies, policy => policy.checks?.includes('references'))
    const managed = new Map(), required = new Map()
    for (const [kind, values] of Object.entries(objects)) {
      if (excluded.has(kind)) continue
      const stages = new Set(Object.keys(values))
      const grants = new Set()
      const references = new Set()
      managed.set(kind, grants)
      required.set(kind, references)
      for (const [target, value] of Object.entries(values)) {
        const policy = policyFor(content, kind, target)
        if (policy.grants) grants.add(target)
        if (policy.checks.has('references')) references.add(target)
        if (!value?.stages?.length) continue
        for (const [index, stage] of value.stages.entries()) {
          const id = stageName(target, stage.id)
          if (policy.stages && policy.grants) grants.add(id)
          if (policy.stages && policy.checks.has('references')) references.add(id)
          const at = `${kind} ${target}.stages[${index}]`
          if (stages.has(id)) fail(`${at}: duplicate object or stage ${id}`)
          stages.add(id)
          if (id.split('/')[0] !== target.split('/')[0]) fail(`${at}: a stage belongs to its object's namespace`)
          if (stage.afterLevel && stage.afterTask) fail(`${at}: choose a level or a task for this stage`)
          if (policy.stages && policy.checks.has('stages') && !policy.grants && index && !stage.afterLevel && !stage.afterTask) fail(`${at}: a later stage needs a level or task to pass`)
        }
      }
    }
    for (const level of content.levels) {
      for (const object of [level, ...(level.tasks ?? [])]) {
        for (const field of fields) for (const id of object[field] ?? []) {
          const [kinds, targets] = field === 'requiresObjects' ? [requiredScope(level.id), required] : [scope(level.id), managed]
          if (!kinds.some(kind => targets.get(kind)?.has(id))) fail(`${object.id}.${field}: ${id} has no applicable progress policy`)
        }
      }
    }
    return problems
  },
}

export { objectProgress } from './objects.js'

export function register(kernel) {
  for (const name of Object.values(levelMarks)) kernel.tag(name, 'level')
  kernel.kind('progress/policy', progressMeaning)
}
