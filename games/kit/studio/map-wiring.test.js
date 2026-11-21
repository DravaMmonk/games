import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mapWiringContent, noteMapWires } from './map-wiring.js'
import { addEdgeOps, removeEdgeOps } from './override-edit.js'

const name = 'p/route'
const layer = '@g'
const levels = ['a', 'b', 'c', 'd'].map((id) => ({ id: `p/${id}` }))
const edge = (from, to) => ({ from: `p/${from}`, to: `p/${to}` })
const original = { kind: 'requires', edges: [edge('a', 'b')] }
const content = {
  id: 'g', eras: [{ levels }], overrideHistory: [], relations: { [name]: original },
  registries: { level: Object.fromEntries(levels.map((level) => [level.id, level])) },
  relationEdges: { requires: original.edges },
}
const edges = (view) => view.relationEdges.requires

function edit(view, ops, operation, from, to) {
  const source = { ...view, registries: { ...view.registries, relation: view.relations } }
  const changes = operation(source, layer, `p/${from}`, `p/${to}`)
  noteMapWires(source, ops, changes)
  return [...ops, ...changes]
}

test('rapid wire edits to the same relation compose while the preview is still on the original graph', () => {
  const first = edit(content, [], addEdgeOps, 'a', 'c')
  const second = edit(mapWiringContent(content, first, []), first, addEdgeOps, 'a', 'd')
  const third = edit(mapWiringContent(content, second, []), second, removeEdgeOps, 'a', 'c')
  assert.deepEqual(edges(mapWiringContent(content, third, [])), [edge('a', 'b'), edge('a', 'd')])
  assert.deepEqual(third.at(-1).data, { edges: { add: [edge('a', 'd')] } })
})

test('undo and redo use the pending graph even when the last preview includes the undone wire', () => {
  const first = edit(content, [], addEdgeOps, 'a', 'c')
  const preview = mapWiringContent(content, first, [])
  const removed = edit(preview, first, removeEdgeOps, 'a', 'c')
  assert.equal(removed.at(-1).op, 'override.remove')
  assert.deepEqual(edges(mapWiringContent(preview, removed, first)), original.edges)
  assert.deepEqual(edges(mapWiringContent(preview, [], first)), original.edges)
  assert.equal(mapWiringContent(preview, first, first), preview)
})

test('layout changes allow wiring to continue while pending graph changes require a preview', () => {
  assert.equal(mapWiringContent(content, [{ op: 'chapter.set', path: ['rows'] }], []), content)
  assert.equal(mapWiringContent(content, [{ op: 'chapter.set', path: ['levels'] }], []), null)
})
