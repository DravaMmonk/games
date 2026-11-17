// The board always connects individual levels.
import { dependencyCycle, dependencyLayers } from '../course.js'

export const externalPort = (game, id) => `${game}:${id}`

export const linkKey = ({ from, to }) => JSON.stringify([from, to])

/** Render one wire per pair while retaining every reason the prerequisite exists. */
export function projectWires(links) {
  const byPair = new Map()
  for (const link of links) {
    const edge = link.fromGame ? { ...link, fromLevel: link.from, from: externalPort(link.fromGame, link.from) } : link
    const key = linkKey(edge)
    const previous = byPair.get(key)
    const causes = [...(previous?.causes ?? []), { source: edge.source, detail: edge.detail }]
    const shown = !previous || edge.source === 'course' ? edge : previous
    byPair.set(key, { ...shown, causes, required: previous?.required || edge.required })
  }
  return [...byPair.values()]
}

/** Describe induced changes in the effective graph while the author edits a course. */
export function implicitWireChanges(before, after) {
  const identity = (edge) => `${linkKey(edge)}:${Boolean(edge.required)}`
  const diff = (one, other) => {
    const known = new Set(other.map(identity))
    return one.filter((edge) => edge.causes.some(({ source }) => source === 'reference') && !known.has(identity(edge)))
  }
  return { added: diff(after, before), removed: diff(before, after) }
}

export function wiringBoard(levelIds, pins, requires, links) {
  const inside = new Set(levelIds)
  const edges = links.filter(({ from, to }) => inside.has(from) || inside.has(to) || (pins.includes(from) && pins.includes(to)))
  const hosted = new Set([...inside, ...edges.flatMap(({ from, to }) => [from, to]), ...pins])
  const rows = dependencyLayers([...hosted], requires).map((ids) =>
    ids.map((id) => ({ id, portal: !inside.has(id) })))
  return { rows, edges, hosted }
}

export function wiringRefusal(requires, from, to) {
  if (from === to) return 'self'
  const incoming = requires.get(to)
  if (incoming?.includes(from)) return 'duplicate'
  const next = new Map(requires)
  next.set(to, [...(incoming ?? []), from])
  return dependencyCycle(next) ? 'cycle' : null
}

const WIDTH = 180
const PAD = 42
const GAP = 52
const PORT = 44
const HEAD = 40

/**
 * Where each card of a wiring board goes: `rows` its rows (dependency layers), `available` the board's width,
 * `positions` cards moved by hand, `widthOf(id)` a card's own width (as wide as its label, so a name is never cut).
 * A row too wide for the board goes on in a band below; each band is centred.
 */
export function boardGeometry(rows, available, positions = new Map(), widthOf = () => WIDTH) {
  const inner = Math.max(0, available - PAD * 2)
  const widest = Math.max(WIDTH, ...rows.flat().map((node) => widthOf(node.id)))
  const width = Math.max(widest + PAD * 2, available)
  const cards = [], ports = new Map()
  let y = PAD, bottom = 0
  for (const row of rows) {
    // The row's cards in bands, as many as fit side by side (one at least).
    const bands = []
    for (const node of row) {
      const w = widthOf(node.id)
      const band = bands.at(-1)
      if (band && band.width + GAP + w <= Math.max(inner, widest)) { band.nodes.push(node); band.width += GAP + w }
      else bands.push({ nodes: [node], width: w })
    }
    for (const band of bands) {
      let x0 = (width - band.width) / 2
      let tallest = 0
      for (const node of band.nodes) {
        const w = widthOf(node.id)
        const position = positions.get(node.id)
        const x = position ? Math.min(width - w - PAD, Math.max(PAD, position.x)) : x0
        const top = position ? Math.max(PAD, position.y) : y
        const height = (node.portal ? HEAD : 0) + PORT
        cards.push({ ...node, x, y: top, width: w, height })
        ports.set(node.id, {
          input: { x: x + w / 2, y: top },
          output: { x: x + w / 2, y: top + height },
        })
        bottom = Math.max(bottom, top + height)
        tallest = Math.max(tallest, height)
        x0 += w + GAP
      }
      y += tallest + GAP
    }
  }
  return { cards, ports, width, height: Math.max(120, y - GAP + PAD, bottom + PAD) }
}

/** The middle of a wire (wireCurve's curve at its halfway point), where its delete button sits. */
export function wireMiddle(from, to) {
  const distance = to.y - from.y
  const bend = distance > 0 ? Math.min(90, distance * 0.45) : 48
  // A cubic curve at t = 1/2: (p0 + 3 p1 + 3 p2 + p3) / 8, its control points straight below and above the ends.
  return { x: (from.x + to.x) / 2, y: (from.y + 3 * (from.y + bend) + 3 * (to.y - bend) + to.y) / 8 }
}

export function wireCurve(from, to) {
  const distance = to.y - from.y
  const bend = distance > 0 ? Math.min(90, distance * 0.45) : 48
  return `M${from.x} ${from.y} C${from.x} ${from.y + bend} ${to.x} ${to.y - bend} ${to.x} ${to.y}`
}
