import { policyFor, referenceDependencies as requirements, externalSupplies as supplies, stageProviders } from 'progress'
import { partStages, requiredStage } from './part-stages.js'
import { textParse as parse } from '../index.js'
const list = items => Array.isArray(items) ? items : []

function referenceItems(task, parts, stages) {
  if (!Array.isArray(task?.solution) || !task.solution.every((line) => typeof line === 'string')) return []
  try {
    return parse(task.solution.join('\n')).statements.flatMap(({ id, type, settings }) => type && !list(task.preset).includes(id) ? [
      type,
      requiredStage(parts, type, settings, stages),
    ] : [])
  } catch (error) {
    // The domain's blueprint check reports a syntax error with a line number.
    if (error?.zh) return []
    throw error
  }
}

const publications = task => list(task.publishes).flatMap(entry => entry?.part ?? [])

export function referenceDependencies(context) {
  const parts = context.content.partDefs?.parts ?? {}
  const stages = partStages(parts)
  const checked = id => policyFor(context.content, 'circuit/part', stages.get(id)?.part ?? id).checks.has('references')
  const extraProviders = stageProviders(context.content, [...stages.values()]
    .filter(stage => checked(stage.id)).map(stage => ({ ...stage, item: stage.id })))
  return requirements(context, { publications, extraProviders,
    itemsOf: (_level, task) => referenceItems(task, parts, stages).filter(checked) })
}

export const externalSupplies = context => supplies(context, publications)
