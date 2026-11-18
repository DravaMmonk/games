import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scaledDotProductAttention } from 'machine-learning'
import { packageLayers } from '../../../games/kit/engine/resolver.js'

test('machine learning loads without any domain package', () => {
  assert.deepEqual(packageLayers('machine-learning').map(layer => layer.id), ['machine-learning'])
})

test('attention mixes value vectors independently of the query width', () => {
  const queries = [Float64Array.of(Math.log(3) * Math.SQRT2, 0), Float64Array.of(0, 1)]
  const keys = [[1, 0], [0, 0]]
  const values = [[8, 4, 0], [4, 4, 4]]
  const [first, second] = scaledDotProductAttention(queries, keys, values)
  for (const [i, expected] of [7, 4, 1].entries()) assert.ok(Math.abs(first[i] - expected) < 1e-12)
  assert.deepEqual([...second], [6, 4, 2])
})
