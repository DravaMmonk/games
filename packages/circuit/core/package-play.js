/** Omitted trays mean all parts, even when the package happens to declare only one tray. */
export function standaloneParts(content, at) {
  const level = content.levels.find(({ id }) => id === at.id)
  const named = level?.tasks?.[at.task]?.tray ?? level?.tray
  if (!named) return Object.keys(content.registries?.['circuit/part'] ?? content.partDefs?.parts ?? {})
  return [...new Set([named].flat().flatMap(name => (content.trays[name]?.items ?? [])
    .flatMap(item => typeof item === 'string' ? [item] : item.items)))]
}
