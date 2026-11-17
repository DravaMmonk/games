/** Diagnose data that requires an optional package before running any board. */
export function progressFieldsProblems(content, vocabulary) {
  if (vocabulary.meanings?.some(meaning => meaning.circuitProgress)) return []
  const needs = (value, fields, at) => fields.filter(key => Object.hasOwn(value, key))
    .map(key => ({ at: `${at}.${key}`, says: 'requires the progress package' }))
  const fields = ['adds', 'gives', 'withholds', 'opens', 'awards', 'local']
  return [
    ...content.levels.flatMap(level => [
      ...needs(level, fields, `levels/${level.id}.json`),
      ...(level.tasks ?? []).flatMap((task, index) => needs(task, fields, `levels/${level.id}.json.tasks[${index}]`)),
    ]),
    ...Object.entries(content.registries?.['circuit/part'] ?? {}).flatMap(([id, part]) => needs(part, ['stages'], `parts/${id}.json`)),
    ...Object.entries(content.registries?.['circuit/tray'] ?? {}).flatMap(([id, tray]) => needs(tray, ['workshop'], `trays/${id}.json`)),
  ]
}
