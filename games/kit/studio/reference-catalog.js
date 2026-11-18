/** Use the same registered targets for labels, validation, and insertion in every workspace. */
export function referenceCatalog(raw, onLevel) {
  if (!raw) return null
  const groups = raw.references
  const byKind = Object.fromEntries(groups.map(({ kind, items }) => [kind, new Map(items.map(item => [item.id, item]))]))
  const options = groups.flatMap(({ kind, label: group, items }) => items.map(({ id, label, title }) => ({
    value: `${kind}:${id}`, label: label ?? id, title, group,
  })))
  const introducedAt = new Map()
  for (const { targetKind, items } of groups) {
    const introductions = introducedAt.get(targetKind) ?? new Map()
    for (const { object, at } of items) if (object && at) introductions.set(object, at)
    introducedAt.set(targetKind, introductions)
  }
  return { byKind, options, introducedAt, onLevel }
}
