// Pure edits of a chapter's route map for the arrange workspace's map editor (games/design/README.md 2.6, MapEditor.jsx): the
// chapter's `rows` in its chapter file, rows of one to three places, `null` an empty place, full names.

export const ROW_SLOTS = 3

/** Where a level is on the rows: { row, slot }, or null when it is not placed. */
export function placeOf(rows, id) {
  for (let row = 0; row < rows.length; row++) {
    const slot = rows[row].indexOf(id)
    if (slot >= 0) return { row, slot }
  }
  return null
}

/** The levels of `members` (a chapter's, in its order) that no row places. */
export const unplacedOf = (rows, members) => {
  const placed = new Set((rows ?? []).flat())
  return members.filter((id) => !placed.has(id))
}

/**
 * The rows with level `id` put at `to`: { row, slot } (slot = the row's length adds a place at its end) or
 * { row, new: true } (a row of its own before row `row`). A level moved from another place swaps with what was at
 * `to` (an empty place stays behind); an unplaced level puts what was at `to` off the map. The same rows when the
 * place cannot take it.
 */
export function placeLevel(rows, id, to) {
  const next = rows.map((row) => [...row])
  const from = placeOf(rows, id)
  if (to.new) {
    if (from) next[from.row][from.slot] = null
    next.splice(Math.max(0, Math.min(to.row, next.length)), 0, [id])
    return next
  }
  const row = next[to.row]
  if (!row || to.slot < 0 || to.slot > row.length || (to.slot === row.length && row.length >= ROW_SLOTS)) return rows
  if (from && from.row === to.row && from.slot === to.slot) return rows
  const there = to.slot < row.length ? row[to.slot] : null
  row[to.slot] = id
  if (from) next[from.row][from.slot] = there
  return next
}

/** The rows with level `id` taken off the map: its place stays, empty. */
export const clearLevel = (rows, id) => rows.map((row) => row.map((x) => (x === id ? null : x)))

/** The rows with an empty place added at the end of row `row` (a row holds at most three). */
export const addPlace = (rows, row) => rows.map((r, k) => (k === row && r.length < ROW_SLOTS ? [...r, null] : r))

/** The rows without the empty place `slot` of row `row`; a row left with no place goes. */
export function removePlace(rows, row, slot) {
  if (rows[row]?.[slot] !== null) return rows
  const next = rows.map((r) => [...r])
  next[row].splice(slot, 1)
  return next[row].length ? next : next.filter((_, k) => k !== row)
}

/** The rows with a new row of one empty place before row `at` (at the end by default). */
export const addRow = (rows, at = rows.length) => [...rows.slice(0, at), [null], ...rows.slice(at)]

/** The rows without row `row` (its levels go off the map). */
export const removeRow = (rows, row) => rows.filter((_, k) => k !== row)

/** Every level that `id` needs, all the way back along `edges` ({ from, to }: from is a prerequisite of to). */
function prerequisitesOf(id, incoming) {
  const seen = new Set()
  const walk = (to) => { for (const from of incoming.get(to) ?? []) if (!seen.has(from)) { seen.add(from); walk(from) } }
  walk(id)
  return seen
}

/** Every pair { from, to } of placed levels where `from` is a prerequisite of `to` and not in a row above it. */
export function rowConflicts(rows, edges) {
  const row = new Map(rows.flatMap((r, k) => r.filter((x) => x !== null).map((x) => [x, k])))
  const incoming = new Map()
  for (const { from, to } of edges) incoming.set(to, [...(incoming.get(to) ?? []), from])
  const out = []
  for (const [to, at] of row) for (const from of prerequisitesOf(to, incoming)) if (row.has(from) && row.get(from) >= at) out.push({ from, to })
  return out
}

/** Find the shortest route between two levels, returning its links from the dependent level backwards. */
export function prerequisitePath(edges, from, to) {
  const incoming = new Map()
  for (const edge of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, [])
    incoming.get(edge.to).push(edge)
  }
  const paths = new Map([[to, []]])
  for (const [level, path] of paths) for (const edge of incoming.get(level) ?? []) {
    if (edge.from === from) return [...path, edge]
    if (!paths.has(edge.from)) paths.set(edge.from, [...path, edge])
  }
  return []
}

/** The row conflicts introduced by a move, with direct prerequisites before indirect ones. */
export function newRowConflicts(before, after, edges) {
  const key = ({ from, to }) => `${from} ${to}`
  const had = new Set(rowConflicts(before, edges).map(key))
  const direct = new Set(edges.map(key))
  return rowConflicts(after, edges).filter(edge => !had.has(key(edge)))
    .sort((a, b) => Number(direct.has(key(b))) - Number(direct.has(key(a))))
}

/** The first new row conflict introduced by a prerequisite, including indirect prerequisites. */
export function wiringLayoutRefusal(rows, edges, edge) {
  const had = new Set(rowConflicts(rows, edges).map(({ from, to }) => `${from} ${to}`))
  return rowConflicts(rows, [...edges, edge]).find(({ from, to }) => !had.has(`${from} ${to}`)) ?? null
}
