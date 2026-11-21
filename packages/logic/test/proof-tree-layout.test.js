import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layoutProofTree } from '../view/ui/proof-tree-layout.js'

test('proof branches make room only for nodes on shared rows', () => {
  const node = (id, ...children) => ({ id, children })
  const root = node(0, node(1), node(2, node(3), node(4), node(5)))
  const widths = new Map([[0, 24], [1, 24], [2, 40], [3, 64], [4, 24], [5, 64]])
  const gap = 8
  const { positions, rows } = layoutProofTree(root, widths, gap)
  const separation = (left, right) =>
    positions.get(right).x - positions.get(left).x - (widths.get(left) + widths.get(right)) / 2
  assert.equal(rows, 3)
  assert.equal(positions.get(root.id).x, 0)
  assert.equal(separation(1, 2), gap)
  assert.equal(separation(3, 4), gap)
  assert.equal(separation(4, 5), gap)
})
