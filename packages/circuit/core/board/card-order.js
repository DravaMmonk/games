import { byId, placement } from './model.js'
import { regionAddress, regionsOf } from './regions.js'

/** The circled numbers parts are named by on a phone board (① ②…), past ⑳ #21. */
export const NUMBERS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
export const numberAt = (index) => NUMBERS[index] ?? `#${index + 1}`

/** Parts in reading order (the order their numbers go in): the board's slots, and a frame's regions right after the
 *  frame. Every node placed is listed; a caller numbers only the parts. */
export function cardOrder(graph, parts) {
  const ordered = []
  const walk = (region) => {
    const { cell } = placement(graph, parts, region)
    for (const id of [...cell.keys()].sort((x, y) => cell.get(x) - cell.get(y))) {
      ordered.push(id)
      for (const r of regionsOf(parts, byId(graph, id))) walk(regionAddress(id, r.name))
    }
  }
  walk(null)
  return ordered
}
