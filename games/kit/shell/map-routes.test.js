import test from 'node:test'
import assert from 'node:assert/strict'
import { groupMapRoutes } from './map-routes.js'

const positions = (rows) => new Map(rows.flatMap((ids, row) => ids.map((id) => [id, { row }])))
const wire = (from, to) => ({ from, to })

test('adjacent targets share a route for the same prerequisites in either order', () => {
  const at = positions([['earlier'], ['a', 'b'], ['c', 'd', 'e'], ['later']])
  const direct = [wire('earlier', 'c'), wire('a', 'e'), wire('a', 'later'), wire('b', 'later')]
  const edges = [wire('a', 'c'), wire('b', 'c'), wire('b', 'd'), wire('a', 'd'), ...direct]
  assert.deepEqual(groupMapRoutes(at, edges), {
    joined: [{ from: ['a', 'b'], to: ['c', 'd'], row: 2 }],
    direct,
  })
})

test('different adjacent prerequisite sets and skipped rows retain their own wires', () => {
  const at = positions([['a', 'b', 'c'], ['d', 'e'], ['f', 'g']])
  const edges = [
    wire('a', 'd'), wire('b', 'd'),
    wire('a', 'e'), wire('b', 'e'), wire('c', 'e'),
    wire('a', 'f'), wire('b', 'f'), wire('a', 'g'), wire('b', 'g'),
  ]
  assert.deepEqual(groupMapRoutes(at, edges), { joined: [], direct: edges })
})
