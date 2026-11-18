import { policyFor } from 'progress'

/** Diagnose data that requires an optional package before running any board. */
export function progressFieldsProblems(content) {
  if (policyFor(content, 'circuit/part').grants) return []
  const needs = (value, fields, at) => fields.filter(key => Object.hasOwn(value, key))
    .map(key => ({ at: `${at}.${key}`, says: 'requires a circuit/part grant policy' }))
  return [
    ...Object.entries(content.registries?.['circuit/tray'] ?? {}).flatMap(([id, tray]) => needs(tray, ['includeUnlisted'], `trays/${id}.json`)),
  ]
}
