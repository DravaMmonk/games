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
