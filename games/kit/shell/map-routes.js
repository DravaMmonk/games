/** Bundle only targets with the same set of at least two prerequisites in the preceding row. */
export function groupMapRoutes(at, edges) {
  const incoming = new Map()
  for (const edge of edges) {
    const from = at.get(edge.from), to = at.get(edge.to)
    if (!from || !to || to.row !== from.row + 1) continue
    if (!incoming.has(edge.to)) incoming.set(edge.to, [])
    incoming.get(edge.to).push(edge)
  }

  const bySources = new Map()
  for (const [to, wires] of incoming) {
    const from = [...new Set(wires.map((edge) => edge.from))].sort()
    if (from.length < 2) continue
    const key = JSON.stringify(from)
    if (!bySources.has(key)) bySources.set(key, { from, to: [], wires: [] })
    const route = bySources.get(key)
    route.to.push(to)
    route.wires.push(...wires)
  }

  const joined = [], bundled = new Set()
  for (const { from, to, wires } of bySources.values()) {
    if (to.length < 2) continue
    joined.push({ from, to, row: at.get(to[0]).row })
    for (const edge of wires) bundled.add(edge)
  }
  return { joined, direct: edges.filter((edge) => !bundled.has(edge)) }
}
