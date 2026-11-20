// A part's stages as the studio shows them (games/design/README.md 6.8): the part itself, then each stage with what it
// changes over the one before; at each step every setting with what the operation declares, what the part (or its
// stages so far) narrows, and what holds there.
import { stageChain as stagesOf, stageName } from 'progress'
import { stagePatch } from './part-stages.js'
import { parameterSetting, settingsResolveSettings as resolveSettings, settingParameters } from '../index.js'

/** A stage's full id: a short stage id in the part's namespace. */
export const stageId = stageName

/** The changes a stage writes, one per field (a setting's narrowing one per setting): [{ path, value }]. */
export function stageChanges(stage) {
  return Object.entries(stage).filter(([key]) => key !== 'id').flatMap(([key, value]) => (key === 'settings' && value && typeof value === 'object'
    ? Object.entries(value).map(([setting, patch]) => ({ path: ['settings', setting], value: patch }))
    : [{ path: [key], value }]))
}

/**
 * The settings at one step: [{ key, declared (the operation parameter's setting, or null when the part writes it
 * whole), narrowed (what the part and its stages so far write over it; null: as declared), effective, changed (this
 * step changes it) }].
 */
export function settingRows(definition, operations, changed = []) {
  const parameters = settingParameters(definition, operations)
  const effective = new Map(resolveSettings(definition, operations).map((setting) => [setting.key, setting]))
  return [...effective.keys()].map((key) => ({
    key,
    declared: parameters.get(key)?.length ? parameterSetting(parameters.get(key)[0]) : null,
    narrowed: definition.settings?.[key] && Object.keys(definition.settings[key]).length ? definition.settings[key] : null,
    effective: effective.get(key),
    changed: changed.includes(key),
  }))
}

/**
 * The chain of part `part` (`raw`: its file): [{ id, index, changes, definition, settings }], the part itself first.
 * `operations`: the kernel's operation declarations by name.
 */
export function stageChain(part, raw, operations = {}) {
  return stagesOf(part, raw ?? {}, stagePatch).map(step => {
    const changes = step.index ? stageChanges(raw.stages[step.index - 1]) : []
    const changed = step.index ? changes.filter(change => change.path[0] === 'settings').map(change => change.path[1]) : Object.keys(step.definition.settings ?? {})
    return { ...step, changes, settings: settingRows(step.definition, operations, changed) }
  })
}

/** The part as a stage of it has it (its definition there, with the stages it still has to come). */
export function partAtStage(part, raw, stage) {
  const step = stageChain(part, raw).find((s) => s.id === stage)
  return step ? { ...step.definition, stages: (raw.stages ?? []).slice(step.index) } : raw
}

/** A free id for a new stage of `part`, among the ids `taken`. */
export function newStageId(part, taken) {
  const short = part.slice(part.indexOf('/') + 1)
  let k = 2
  while (taken.includes(stageId(part, `${short}-${k}`))) k += 1
  return `${short}-${k}`
}

/** Where stage `stage` of part `part` is in its file (`raw`): ['stages', index], or null for the part itself or a stage it lacks. */
export function stagePath(part, raw, stage) {
  const index = stage ? (raw?.stages ?? []).findIndex((entry) => stageId(part, entry.id) === stage) : -1
  return index < 0 ? null : ['stages', index]
}

/** A path in the part's file (`path`) read from inside the stage at `at` (stagePath): the rest of it, or null outside. */
export function withinStage(path, at) {
  if (!at) return path
  return path.length >= at.length && at.every((key, k) => path[k] === key) ? path.slice(at.length) : null
}
