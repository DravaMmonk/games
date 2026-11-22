// A tree with holes, for a strip that builds one (a formula, a proof term): a node's children each take some kind of
// thing, and an empty child (null) is a hole. A game says what a node's children are and how to replace one; this
// gives the rest. A path is the child indices from the root: [] is the root, [1, 0] the first child of its second.
//
//   holeTree({ kids(node) → [{ kind, value }], withKid(node, k, value) → node, root, orderOf? })
//   orderOf(node, kids) lists child indices in reading order.

export function holeTree({ kids, withKid, root = 'any', orderOf = (_, list) => [...list.keys()] }) {
  const order = (node) => orderOf(node, kids(node))
  const nodeAt = (tree, path) => path.reduce((node, k) => (node != null ? kids(node)[k]?.value ?? null : null), tree)
  const setAt = (tree, path, value) => {
    if (!path.length) return value
    const [k, ...rest] = path
    return withKid(tree, k, setAt(kids(tree)[k].value, rest, value))
  }
  // Every empty hole, in reading order, with the kind it takes.
  const holesOf = (tree, path = [], kind = root) => {
    if (tree == null) return [{ path, kind }]
    const list = kids(tree)
    return orderOf(tree, list).flatMap(k => holesOf(list[k].value, [...path, k], list[k].kind))
  }
  const kindAt = (tree, path) => (path.length ? kids(nodeAt(tree, path.slice(0, -1)))[path[path.length - 1]].kind : root)
  const complete = (tree) => tree != null && !holesOf(tree).length
  // From a path, up through each parent `up(parent, k)` lets it climb out of (k: which child it is): how far a part
  // joining on reaches back, by how tightly the parts around bind (A ∧ B then → takes A ∧ B; p q then □ □ takes p q).
  const outward = (tree, path, up) => {
    let at = path
    while (at.length && up(nodeAt(tree, at.slice(0, -1)), at[at.length - 1])) at = at.slice(0, -1)
    return at
  }

  /** Join a chip with a leading hole to the rightmost compatible complete expression. */
  const joinChips = ({ kindOf, fitsSlot, leadingSlot, precedenceOf, rightAssociative }) => (tree, chip, made) => {
    const first = kids(made)[leadingSlot(made)]
    if (!first) return null

    const rightmost = (node, path, kind) => {
      if (node == null) return null
      const list = kids(node)
      for (const k of orderOf(node, list).slice().reverse()) {
        const kid = list[k]
        const found = rightmost(kid.value, [...path, k], kid.kind)
        if (found) return found
      }
      return kindOf(node) === first.kind && fitsSlot(chip, kind) && complete(node) ? path : null
    }
    const path = rightmost(tree, [], root)
    const rank = precedenceOf(made)
    if (!path || rank === undefined) return path
    // An unranked parent bounds the join.
    return outward(tree, path, (parent, index) => {
      const parentRank = precedenceOf(parent)
      return index === order(parent).at(-1) && kindOf(parent) === first.kind && complete(parent) &&
        (parentRank > rank || (parentRank === rank && !rightAssociative(made)))
    })
  }
  return { nodeAt, setAt, holesOf, kindAt, complete, joinChips }
}

export const treeKey = (path) => ['r', ...path].join('.')
export const treePath = (key) => key.split('.').slice(1).map(Number)
