import { operationPart } from './parts/operation.js'
import { resolveSettings } from './parts/settings.js'

/** Runtime card shape for a selected part definition, sharing the stable part id. */
export function partDefinition(entry, operations) {
  if (!entry) return null
  const part = operationPart(entry.definition, operations)
  const settings = resolveSettings(part, operations)
  return { ...part, type: entry.part, stage: entry.id, settings,
    setting: Object.fromEntries(settings.map(setting => [setting.key, setting])),
    outputNames: part.outputs?.map(port => port.name) ?? null }
}

/**
 * A stage's card over the part's compiled one (`fallback`): the stage's fields win, its settings merged over the
 * part's key by key; without a stage, the part's own.
 */
export function stagedDefinition(entry, fallback) {
  const resolved = partDefinition(entry)
  if (!resolved) return fallback
  const settings = Object.values({ ...fallback?.setting, ...Object.fromEntries(resolved.settings.map(setting => [setting.key, { ...fallback?.setting?.[setting.key], ...setting }])) })
  return { ...fallback, ...resolved, settings, setting: Object.fromEntries(settings.map(setting => [setting.key, setting])) }
}
