// The names of particular things in a proof (《证明完毕》). x, y, z are only ever bound by a quantifier; a particular
// thing is named a, b, c … A box that takes one (For any, Take the one there is, induction's second box) is not given
// its name by the player: it takes the first name nothing around it uses — no box it sits in, nothing such a box
// assumes, and nothing in the level's own sentences. The name hangs on the board alone, so a proof names its things
// the same way in every case it runs on and on every screen that draws it. Boxes side by side may take the same name:
// each holds only inside its box, the way de Bruijn levels count binders from the outside in.
import { frameId, frameTree } from 'circuit'
import { OperationError } from 'kernel'
import { freeVars, parse } from './formula.js'

/** The names of particular things, in the order boxes take them. */
export const NAMES = ['a', 'b', 'c', 'd', 'e']

/** Does a text (a card's setting) mention the name n as a word of its own? */
export const mentions = (text, n) => new RegExp(`(^|[^A-Za-z])${n}($|[^A-Za-z])`).test(text)

/** Whether a card is a box that takes a particular thing (a for-any box may take a sentence instead: R). */
export const bindsThing = (parts) => (node) => Boolean(parts?.[node.type]?.binds) && !/^[A-Z]/.test(node.params?.x ?? '')

/** The names a level's own sentences use (its schema's, or its last test's for a bare level), which no box may take. */
export function reservedIn(level) {
  const { premises = {}, goal } = level.schema ?? level.tests.at(-1)
  return [...new Set([...Object.values(premises), goal].flatMap((t) => [...freeVars(parse(t, { consts: level.consts ?? [] }))]))]
}

// What a card says on its settings, but for the letter a for-any box may take (x).
const said = (node) => Object.entries(node.params ?? {}).filter(([key, v]) => key !== 'x' && typeof v === 'string').map(([, v]) => v)

/**
 * The name each box of a board takes ({ node id → name }): `binds(node)` tells a box that takes a particular thing,
 * `reserved` are the names the level's own sentences use.
 */
export function boxNames(graph, binds, reserved = []) {
  const tree = frameTree(graph.nodes ?? [])
  const names = new Map()
  const nameOf = (node) => {
    if (names.has(node.id)) return names.get(node.id)
    const scope = node.in ? tree.ancestors(node.in) : []
    if (!scope) throw new OperationError({ zh: '框的区域出现循环嵌套', en: 'Frame regions form a containment cycle' })
    const taken = new Set(reserved)
    const outer = scope.map((region) => tree.node(frameId(region))).filter(Boolean)
    for (const box of outer) if (binds(box)) taken.add(nameOf(box))
    for (const text of [...outer, node].flatMap(said)) for (const n of NAMES) if (mentions(text, n)) taken.add(n)
    const name = NAMES.find((n) => !taken.has(n))
    if (!name) throw new OperationError({ zh: '框套得太深，名字不够用了', en: 'Boxes nest too deep: no name is left' })
    names.set(node.id, name)
    return name
  }
  return Object.fromEntries((graph.nodes ?? []).filter(binds).map((node) => [node.id, nameOf(node)]))
}

/**
 * What a card picks a thing or an instance from where it sits (`node` on `graph`): the level's offer (`values`, texts)
 * but those naming a thing only a box elsewhere takes (it exists inside that box alone), and each name a box around it
 * takes.
 */
export function pickableAt(values, graph, node, binds, reserved = []) {
  const taken = boxNames(graph, binds, reserved)
  const tree = frameTree(graph.nodes ?? [])
  const boxes = ((node.in && tree.ancestors(node.in)) || []).map((region) => tree.node(frameId(region))).filter(Boolean)
  const inScope = new Set(boxes.filter(binds).map((box) => taken[box.id]))
  const elsewhere = Object.values(taken).filter((n) => !inScope.has(n) && !reserved.includes(n))
  const kept = values.filter((v) => !elsewhere.some((n) => mentions(v, n)))
  return [...kept, ...NAMES.filter((n) => inScope.has(n) && !kept.includes(n))]
}

// Each name of `map` in a text, all at once, as the name it maps to.
const renamed = (text, map) => text.replace(new RegExp(`(^|[^A-Za-z])(${[...map.keys()].join('|')})(?=$|[^A-Za-z])`, 'g'), (_, before, n) => before + map.get(n))

/**
 * A board after an edit (`next`, `prev` before it), its cards following the names its boxes take: a box moved into or
 * out of another may take another name, and every card inside it that named its thing names it anew. Only a box whose
 * cards the edit left as they were follows: a board put in place of another (imported, switched) keeps its own names.
 */
export function followNames(prev, next, binds, reserved = []) {
  let before, after
  try {
    before = boxNames(prev, binds, reserved)
    after = boxNames(next, binds, reserved)
  } catch (error) {
    if (error instanceof OperationError) return next
    throw error
  }
  const tree = frameTree(next.nodes)
  const outer = new Map(next.nodes.map((node) => [node.id, ((node.in && tree.ancestors(node.in)) || []).map(frameId)]))
  const was = new Map(prev.nodes.map((node) => [node.id, node]))
  const kept = (node) => was.get(node.id)?.type === node.type && JSON.stringify(was.get(node.id).params ?? {}) === JSON.stringify(node.params ?? {})
  const moved = new Set(Object.keys(after).filter((id) => before[id] && before[id] !== after[id]
    && next.nodes.every((node) => !outer.get(node.id).includes(id) || kept(node))))
  if (!moved.size) return next
  const nodes = next.nodes.map((node) => {
    const map = new Map(outer.get(node.id).filter((id) => moved.has(id)).map((id) => [before[id], after[id]]))
    if (!map.size || !node.params) return node
    return { ...node, params: Object.fromEntries(Object.entries(node.params).map(([key, v]) => [key, key !== 'x' && typeof v === 'string' ? renamed(v, map) : v])) }
  })
  return { ...next, nodes }
}
