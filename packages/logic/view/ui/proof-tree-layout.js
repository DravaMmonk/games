/** Pack ordered subtrees against each other where their rows overlap. */
export function layoutProofTree(root, widths, gap) {
  function pack(node) {
    const left = []
    const right = []
    const children = node.children.map(child => {
      const next = pack(child)
      let offset = 0
      if (left.length) {
        offset = Math.max(...next.left.slice(0, right.length).map((edge, depth) => right[depth] + gap - edge))
      }
      next.left.forEach((edge, depth) => {
        left[depth] = Math.min(left[depth] ?? Infinity, edge + offset)
        right[depth] = Math.max(right[depth] ?? -Infinity, next.right[depth] + offset)
      })
      return { ...next, offset }
    })
    const center = (children.at(-1)?.offset ?? 0) / 2
    const radius = widths.get(node.id) / 2
    return {
      id: node.id,
      children: children.map(child => ({ ...child, offset: child.offset - center })),
      left: [-radius, ...left.map(edge => edge - center)],
      right: [radius, ...right.map(edge => edge - center)],
    }
  }

  const tree = pack(root)
  const positions = new Map()
  const place = (branch, x, depth) => {
    positions.set(branch.id, { x, depth })
    for (const child of branch.children) place(child, x + child.offset, depth + 1)
  }
  place(tree, 0, 0)
  return { positions, left: -Math.min(...tree.left), right: Math.max(...tree.right), rows: tree.left.length }
}
