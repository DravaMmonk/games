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

/** The earliest stage admitting the explicit settings of a reference card. */
export function requiredStage(parts, type, params = {}, stages = partStages(parts)) {
  const chain = [...stages.values()].filter(entry => entry.part === type)
  return chain.find(entry => {
    const settings = partDefinition(entry)?.setting ?? {}
    return Object.entries(params).every(([key, value]) => {
      const setting = settings[key]
      if (!setting) return true
      if (setting.fixed && String(value) !== String(setting.default ?? setting.options?.[0]?.value)) return false
      return !setting.options || setting.options.some(option => String(option.value) === String(value))
    })
  })?.id ?? type
}
