import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gradientStep } from 'machine-learning'

test('finite differences backtrack without mutating the original weights', () => {
  const weights = [3, 5]
  const loss = ([x, y]) => (x - 1) ** 2 + (y - 2) ** 2
  const result = gradientStep(weights, loss, 4)
  assert.equal(result.rate, 0.5)
  assert.ok(result.loss < 1e-7)
  assert.deepEqual(weights, [3, 5])
  assert.ok(gradientStep(weights, loss, 4, { backtrack: false }).loss > loss(weights))
  assert.equal(gradientStep(weights, loss, 8192).weights, weights)
})
