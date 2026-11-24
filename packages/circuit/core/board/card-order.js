import { byId, placement } from './model.js'
import { regionAddress, regionsOf } from './regions.js'

/** The circled numbers parts are named by on a phone board (① ②…), past ⑳ #21. */
export const NUMBERS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
export const numberAt = (index) => NUMBERS[index] ?? `#${index + 1}`

/** Parts in reading order (the order their numbers go in): the board's slots, and a frame's regions right after the
 *  frame. Every node placed is listed; a caller numbers only the parts. */
export function cardOrder(graph, parts) {
  return orderedCards(graph, parts, (region) => {
    const { cell } = placement(graph, parts, region)
    return [...cell.keys()].sort((x, y) => cell.get(x) - cell.get(y))
  })
}

/** On the canvas, near-aligned headers form a row read from left to right. */
export function canvasCardOrder(graph, parts, positions) {
  const rows = new Map()
  for (const node of graph.nodes) {
    if (parts.role(node) !== 'part') continue
    const region = node.in ?? null
    if (!rows.has(region)) rows.set(region, [])
    const { x = 0, y = 0 } = positions?.get(node.id) ?? node
    rows.get(region).push({ id: node.id, x, y })
  }
  return orderedCards(graph, parts, (region) => {
    const cards = (rows.get(region) ?? []).sort((a, b) => a.y - b.y)
    const ordered = []
    for (let start = 0, end = 0; start < cards.length; start = end) {
      while (end < cards.length && cards[end].y - cards[start].y <= 20) end++
      ordered.push(...cards.slice(start, end).sort((a, b) => a.x - b.x).map(({ id }) => id))
    }
    return ordered
  })
}

function orderedCards(graph, parts, idsIn) {
  const ordered = []
  const walk = (region) => {
    for (const id of idsIn(region)) {
      ordered.push(id)
      for (const r of regionsOf(parts, byId(graph, id))) walk(regionAddress(id, r.name))
    }
  }
  walk(null)
  return ordered
}
