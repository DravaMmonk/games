import test from 'node:test'
import assert from 'node:assert/strict'
import {
  at, boxBlur3, channel, compare, compose, correlate, downsample, fromFn, gradientMagnitude,
  horizontalDifference, maxPool, sampleAt, shift, sobelGradient, squaredGradient, throughSamples, zip,
} from 'imglib'

const plane = (values, w = values.length) => ({ w, h: values.length / w, data: Float32Array.from(values) })

test('RGB channels round-trip and monochrome arithmetic broadcasts per pixel', () => {
  const planes = [plane([0.25, 0.5]), plane([0.5, 0.75]), plane([0.75, 1])]
  const rgb = compose(...planes)
  assert.deepEqual(planes.map((_, index) => channel(rgb, index)), planes)
  const scaled = zip(rgb, plane([2, 3]), (value, gain) => value * gain)
  assert.deepEqual(scaled, { w: 2, h: 1, c: 3, data: Float32Array.of(0.5, 1, 1.5, 1.5, 2.25, 3) })
  assert.equal(compare(rgb, planes[0]).pass, false)
  assert.equal(compare(rgb, rgb).pass, true)
})

test('RGB spatial operations preserve each channel', () => {
  const a = plane([1, 2, 3, 4], 2), b = plane([5, 6, 7, 8], 2), c = plane([9, 10, 11, 12], 2)
  const rgb = compose(a, b, c)
  for (const op of [(x) => shift(x, 1, 0), (x) => correlate(x, [1]), downsample, maxPool]) {
    const result = op(rgb)
    for (const [index, source] of [a, b, c].entries()) assert.deepEqual(channel(result, index), op(source))
  }
})

test('an RGB mismatch is counted once per pixel and includes non-finite readings', () => {
  const got = { w: 3, h: 1, c: 3, data: [0.625, 0.375, 0.5, 0.75, 0.75, 0.5, 0.5, NaN, Infinity] }
  const want = { ...got, data: Array(9).fill(0.5) }
  const check = compare(got, want, { tolerance: 0.125, mismatches: 2 })
  assert.deepEqual({ pass: check.pass, wrong: check.wrong, worst: check.worst }, { pass: true, wrong: 2, worst: Infinity })
  assert.equal(compare(got, want, { tolerance: Infinity }).wrong, 1)
})

test('shared neighbourhood filters preserve signs, scaling and edge padding', () => {
  const ramp = fromFn(3, 3, (x, y) => 2 * x + 4 * y)
  const [gx, gy] = sobelGradient(ramp, 'edge')
  assert.deepEqual([at(gx, 1, 1), at(gy, 1, 1)], [2, 4])
  assert.deepEqual([at(gx, 0, 0), at(gy, 0, 0)], [1, 2])
  assert.equal(at(gradientMagnitude(ramp), 1, 1), Math.fround(Math.sqrt(20)))
  assert.equal(at(squaredGradient(ramp), 1, 1), 20)
  assert.ok(Math.abs(at(boxBlur3(ramp), 1, 1) - 6) < 1e-6)
  assert.deepEqual(Array.from(horizontalDifference(ramp).data.slice(0, 3)), [2, 2, -4])
})

test('sampling interpolation preserves phase on odd and even grids', () => {
  const signal = (u) => 0.5 + 0.2 * Math.sin(4 * Math.PI * u) + 0.3 * Math.cos(8 * Math.PI * u)
  const expected = sampleAt(signal, 64)
  for (const count of [8, 9]) {
    const interpolation = throughSamples(sampleAt(signal, count))
    const got = sampleAt(interpolation, expected.length)
    assert.equal(got.length, expected.length)
    assert.ok(got.every((value, i) => Math.abs(value - expected[i]) < 1e-12), `${count} samples`)
  }
})
