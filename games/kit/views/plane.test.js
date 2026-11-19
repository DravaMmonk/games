// The geometry and shared frame of arrows in the plane.
import test from 'node:test'
import assert from 'node:assert/strict'
import { columns, extentOf, frameOf, tips } from './plots/plane.js'

const grid = (w, data) => ({ w, h: 2, c: 1, data })

test('a frame reaches the columns and their running sums, and never closer than two units', () => {
  const pair = grid(2, [3, 1, 0, 4])
  assert.deepEqual(columns(pair), [[3, 0], [1, 4]])
  assert.deepEqual(tips(columns(pair)), [[3, 0], [4, 4]])
  assert.equal(extentOf([pair]), 4)
  assert.deepEqual(frameOf(0), { reach: 2, step: 1 })
  assert.deepEqual(frameOf(extentOf([pair])), { reach: 5, step: 1 })
  assert.deepEqual(frameOf(extentOf([pair, grid(1, [6, 4])])), { reach: 7, step: 1 })
  assert.equal(frameOf(40).reach % frameOf(40).step, 0)
  assert.equal(extentOf([grid(2, [NaN, 3, Infinity, 4])]), 4)
})
