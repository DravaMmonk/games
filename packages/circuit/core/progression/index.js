import { partProblems } from '../index.js'
import { taskIdsOf } from 'kernel'
import { grantingFields, grantScope, objectsOf, policyFor, stageName } from 'progress'
import { partStages } from './part-stages.js'
import { progressCourse, RULE_TEXT } from './course.js'
import { referenceDependencies, externalSupplies } from './course-links.js'

export { partStages, stagePatch } from './part-stages.js'
export { defineCourse, reach, met, audit, againstOpen, RULE_TEXT } from './course.js'

const stagesOf = registries => partStages(registries['circuit/part'])

export const progressMeaning = {
  type: 'circuit/part', read: value => value,
  circuitProgress(course, parts, content, facts) {
    const { stages, grants } = policyFor(content, 'circuit/part')
    if (!stages && !grants) return null
    const definitions = Object.fromEntries(Object.entries(parts).map(([id, part]) => {
      const { stages: _stages, ...base } = part
      return [id, policyFor(content, 'circuit/part', id).stages ? part : base]
    }))
    if (!grants) {
      const availableParts = course.availableParts
      progressCourse(course, definitions)
      course.availableParts = availableParts
      return course
    }
    const otherObjects = new Set()
    for (const [kind, objects] of Object.entries(objectsOf(content))) {
      if (kind === 'circuit/part' || !policyFor(content, kind).grants) continue
      for (const [id, object] of Object.entries(objects)) if (policyFor(content, kind, id).grants) {
        otherObjects.add(id)
        for (const stage of object.stages ?? []) otherObjects.add(stageName(id, stage.id))
      }
    }
    const authored = grantingFields(content, facts)
    const scope = grantScope(Object.entries(content.registries?.['progress/policy'] ?? {}))
    for (const field of ['adds', 'gives', 'withholds', 'opens', 'awards']) {
      course[field] = at => {
        const circuit = scope(at.id).includes('circuit/part')
        return authored[field](at).filter(id => !otherObjects.has(id) || circuit && course.stages.has(id))
      }
    }
    course.local = authored.local
    if (content.standalone) {
      const fallback = course.available
      course.available = at => [...new Set(fallback(at).map(course.partOf))]
      course.availableItems = at => {
        const named = facts.task(at)?.tray ?? facts.level(at).tray
        return named ? fallback(at) : [...course.stages.keys()]
      }
    }
    return progressCourse(course, definitions, content.registries?.['circuit/tray'] ?? course.trays)
  },
  studio: {
    rules: RULE_TEXT,
    member: (content, kind, name) => kind === 'circuit/part' ? stagesOf(content.registries ?? {}).get(name)?.definition : null,
    owners: content => [...stagesOf(content.registries ?? {})].map(([id, { part }]) => [id, part]),
  },
  names: ({ name, vocabulary, objects, parts }) => ({
    rewrite({ value, key, path, schema }) {
      if ((schema && schema.of?.reference !== 'progress/item') || !['adds', 'local', 'gives', 'withholds', 'opens', 'awards'].includes(key) || !Array.isArray(value)) return undefined
      if (path.length !== 1 && path.at(-3) !== 'tasks' && path.at(-2) !== 'reference') return undefined
      const own = new Set([...parts ?? [], ...Object.keys(objects?.['circuit/part'] ?? {}).map(id => id.split('/').at(-1))])
      return { value: value.map(id => (!own.has(id.split(/[.=]/)[0]) && vocabulary?.kinds.primitive?.[id]) ? id : name(id)) }
    },
  }),
  indexes: ({ registries }) => [...stagesOf(registries)].filter(([, entry]) => entry.index > 0)
    .map(([name, entry]) => ({ kind: 'circuit/part', name, value: entry.definition })),
  relationProblems({ name, relation, edges, expand }) {
    if (relation.kind !== 'replaces') return []
    const stages = stagesOf(expand.registries)
    return edges.flatMap(edge => [edge.from, edge.to].flatMap(endpoint =>
      expand(endpoint, 'circuit/part').some(id => stages.get(id)?.index > 0)
        ? [{ at: `relations/${name}`, says: 'replaces only links different base parts; stages upgrade in their declared order' }] : []))
  },
  dependencies: context => policyFor(context.content, 'circuit/part').checks.has('references') ? referenceDependencies(context) : undefined,
  plan: context => policyFor(context.content, 'circuit/part').grants ? externalSupplies(context) : undefined,
  supplies: ({ plan, level }) => plan.externalAwardSources?.has(level),
  validate({ content, vocabulary }) {
    const tasks = taskIdsOf(content.levels)
    const definitions = content.partDefs?.parts ?? content.registries?.['circuit/part'] ?? {}
    if (!policyFor(content, 'circuit/part').checks.has('stages')) return []
    return [...partStages(definitions)].flatMap(([id, entry]) => entry.index && policyFor(content, 'circuit/part', entry.part).checks.has('stages') ?
      partProblems({ parts: { [entry.part]: entry.definition } }, vocabulary, { tasks })
        .map(problem => ({ ...problem, at: `${problem.at} (stage ${id})` })) : [])
  },
}
