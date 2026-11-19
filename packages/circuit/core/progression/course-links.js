import { policyFor, referenceDependencies as requirements, externalSupplies as supplies, stageProviders } from 'progress'
import { partStages, stageForSettings } from './part-stages.js'
import { textParse as parse } from '../index.js'
const list = items => Array.isArray(items) ? items : []

function referenceItems(task, stage) {
  if (!Array.isArray(task?.solution) || !task.solution.every((line) => typeof line === 'string')) return []
  const preset = new Set(list(task.preset))
  try {
    return parse(task.solution.join('\n')).statements.flatMap(({ id, type, settings }) =>
      type && !preset.has(id) ? [type, stage(type, settings)] : [])
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
  const stage = stageForSettings(stages)
  const checkedParts = new Map()
  const checked = id => {
    const part = stages.get(id)?.part ?? id
    if (!checkedParts.has(part)) checkedParts.set(part, policyFor(context.content, 'circuit/part', part).checks.has('references'))
    return checkedParts.get(part)
  }
  const extraProviders = stageProviders(context.content, [...stages.values()]
    .filter(stage => checked(stage.id)).map(stage => ({ ...stage, item: stage.id })))
  return requirements(context, { publications, extraProviders,
    itemsOf: (_level, task) => referenceItems(task, stage).filter(checked) })
}

export const externalSupplies = context => supplies(context, publications)
