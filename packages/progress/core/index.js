import { partProblems } from 'circuit'
import { taskIdsOf, validate } from 'kernel'
import { grantingFields } from './content-course.js'
import { partStages } from './part-stages.js'
import { progressCourse, RULE_TEXT } from './course.js'
import { referenceDependencies, externalSupplies } from './course-links.js'
import { courseChecks, referenceChecks } from './content-checks.js'

export { partStages, stagePatch, requiredStage } from './part-stages.js'
export { defineCourse, reach, met, audit, againstOpen, RULE_TEXT } from './course.js'

const stagesOf = registries => partStages(registries['circuit/part'])
export const levelMarks = { optional: 'progress/optional', skippable: 'progress/skippable' }

export const progressMeaning = {
  type: 'progress/part', read: value => value,
  vocabulary: vocabulary => ({ ...vocabulary, levelMarks }),
  circuitProgress(course, parts, content, facts) {
    Object.assign(course, grantingFields(content, facts))
    if (content.standalone) {
      const fallback = course.available
      course.available = at => [...new Set(fallback(at).map(course.partOf))]
      course.availableItems = at => {
        const named = facts.task(at)?.tray ?? facts.level(at).tray
        return named ? fallback(at) : [...course.stages.keys()]
      }
    }
    return progressCourse(course, parts, content.registries?.['circuit/tray'] ?? course.trays)
  },
  studio: {
    rules: RULE_TEXT,
    member: (content, kind, name) => kind === 'circuit/part' ? stagesOf(content.registries ?? {}).get(name)?.definition : null,
    owners: content => [...stagesOf(content.registries ?? {})].map(([id, { part }]) => [id, part]),
  },
  names: ({ name, vocabulary, objects, parts }) => ({
    rewrite({ value, key, path }) {
      if (key === 'id' && path.length === 3 && path[0] === 'stages') return { value: name(value) }
      if (!['adds', 'local', 'gives', 'withholds', 'opens', 'awards'].includes(key) || !Array.isArray(value)) return undefined
      if (path.length !== 1 && path.at(-3) !== 'tasks' && path.at(-2) !== 'reference') return undefined
      const own = new Set([...parts ?? [], ...Object.keys(objects?.['circuit/part'] ?? {}).map(id => id.split('/').at(-1))])
      return { value: value.map(id => (!own.has(id.split(/[.=]/)[0]) && vocabulary?.kinds.primitive?.[id]) ? id : name(id)) }
    },
  }),
  identities: ({ kind, value }) => kind === 'circuit/part' ? (value.stages ?? []).map(stage => ({ kind, name: stage.id, value: stage })) : [],
  indexes: ({ registries }) => [...stagesOf(registries)].filter(([, entry]) => entry.index > 0)
    .map(([name, entry]) => ({ kind: 'circuit/part', name, value: entry.definition })),
  relationProblems({ name, relation, edges, expand }) {
    if (relation.kind !== 'replaces') return []
    const stages = stagesOf(expand.registries)
    return edges.flatMap(edge => [edge.from, edge.to].flatMap(endpoint =>
      expand(endpoint, 'circuit/part').some(id => stages.get(id)?.index > 0)
        ? [{ at: `relations/${name}`, says: 'replaces only links different base parts; stages upgrade in their declared order' }] : []))
  },
  dependencies: referenceDependencies,
  plan: externalSupplies,
  supplies: ({ plan, level }) => plan.externalAwardSources?.has(level),
  validate({ content, vocabulary }) {
    const tasks = taskIdsOf(content.levels)
    const stageSchema = vocabulary.objectKinds?.['progress/part']?.fields.stages
    const definitions = content.partDefs?.parts ?? content.registries?.['circuit/part'] ?? {}
    const problems = stageSchema ? Object.entries(definitions).flatMap(([id, part]) =>
      (part.stages === undefined ? [] : validate(stageSchema, part.stages, { vocabulary, tasks })).map(problem =>
        ({ at: `parts/${id}.json.stages${problem.at === '(root)' ? '' : problem.at}`, says: problem.says }))) : []
    if (problems.length) return problems
    return [...partStages(definitions)].flatMap(([id, entry]) => entry.index ?
      partProblems({ parts: { [entry.part]: entry.definition } }, vocabulary, { tasks })
        .map(problem => ({ ...problem, at: `${problem.at} (stage ${id})` })) : [])
  },
}

export function register(kernel) {
  for (const name of Object.values(levelMarks)) kernel.tag(name, 'level')
  kernel.kind('progress/part', progressMeaning)
  kernel.check('progress/course', Object.assign(courseChecks, { phase: 'course' }))
  kernel.check('progress/references', Object.assign(referenceChecks, { phase: 'references' }))
}

export {
  captureWorkshop, draftWorkshop, featureWorkshop, loadWorkshop, publishWorkshop, removeWorkshopPart,
  trayKey, workshopAvailable, workshopCompatible, workshopEntries, workshopIdentity, workshopInTray, workshopParts,
} from './workshop.js'
export { courseWorkshop, workshopView } from './workshop-view.js'
export {
  addTerminalPort, addWorkshopTerminal, editWorkshopTerminal, flattenWorkshopTerminals,
  sideLabels, terminalPorts, workshopTerminalParts, WORKSHOP_OUTPUT,
} from './workshop-terminals.js'
