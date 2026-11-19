import { stageChain, stagePatch as patchStage } from 'progress'
import { partDefinition } from '../part-definition.js'

export function stagePatch(base, stage) {
  return patchStage(base, stage, (path, value) => path.length === 2 && path[0] === 'settings' && !Object.keys(value).length)
}

/** Adapt generic stages to the circuit runner's stable part identity. */
export function partStages(parts = {}) {
  const entries = new Map()
  for (const [part, raw] of Object.entries(parts)) for (const { target, id, index, definition, afterLevel, afterTask } of stageChain(part, raw, stagePatch)) {
    if (entries.has(id)) throw new Error(`duplicate part or stage ${id}`)
    if (part.includes('/') && id.split('/')[0] !== part.split('/')[0]) throw new Error(`stage ${id} must belong to ${part.split('/')[0]}`)
    entries.set(id, { part: target, index, id, definition, ...(afterLevel && { afterLevel }), ...(afterTask && { afterTask }) })
  }
  return entries
}

/** Find the earliest admitting stage for each card in a reference dependency check. */
export function stageForSettings(stages) {
  const chains = new Map()
  const settings = new Map()
  for (const entry of stages.values()) {
    if (!chains.has(entry.part)) chains.set(entry.part, [])
    chains.get(entry.part).push(entry)
  }
  return (type, params = {}) => {
    const explicit = Object.entries(params)
    return chains.get(type)?.find(entry => {
      if (!settings.has(entry.id)) settings.set(entry.id, partDefinition(entry).setting)
      const byKey = settings.get(entry.id)
      return explicit.every(([key, value]) => {
        const setting = byKey[key]
        if (!setting) return true
        if (setting.fixed && String(value) !== String(setting.default ?? setting.options?.[0]?.value)) return false
        return !setting.options || setting.options.some(option => String(option.value) === String(value))
      })
    })?.id ?? type
  }
}
