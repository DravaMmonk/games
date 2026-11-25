export function lastIndexMatching(items, matches) {
  for (let index = items.length - 1; index >= 0; index--) {
    if (matches(items[index], index)) return index
  }
  return -1
}

export const lastMatching = (items, matches) => items[lastIndexMatching(items, matches)]

export function groupByKey(items, keyOf) {
  const groups = new Map()
  for (const item of items) {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return groups
}
