import test from 'node:test'
import assert from 'node:assert/strict'
import { distanceToLine, project, ransacLine, robustHomography } from 'cvlib'

test('line and homography estimation fit known correspondences', () => {
  const inliers = [[0, 2], [1, 2], [3, 2]]
  const result = ransacLine([...inliers, [2, 9]], 1, 0.1, () => 0)
  assert.equal(result.inliers, inliers.length)
  for (const point of inliers) assert.equal(distanceToLine(result.line, point), 0)

  const pairs = [[0, 0], [3, 0], [3, 2], [0, 2]].map(([x, y]) =>
    ({ from: [x, y], to: [x + 5, y - 4] }))
  const model = robustHomography(pairs, 0)
  const [x, y] = project(model, 1, 1)
  assert.ok(Math.hypot(x - 6, y + 3) < 1e-8)
})

test('line and homography estimation stop before sampling when there are too few points', () => {
  const next = () => assert.fail('not enough points to sample')
  assert.equal(ransacLine([], 10, 1, next), null)
  assert.equal(ransacLine([[0, 0]], 10, 1, next), null)
  const tooFew = [[0, 0], [1, 0], [0, 1]].map((point) => ({ from: point, to: point }))
  assert.equal(robustHomography(tooFew, 10, next), null)
})
