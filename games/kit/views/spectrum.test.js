import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFrequency, spectrumOf } from './plots/spectrum.js'

const grid = (w, h) => ({ w, h, data: Array.from({ length: w * h }, (_, i) => i) })

test('spectra center zero frequency and scale image strengths by the non-mean bins', () => {
  const near = (actual, expected) => {
    assert.equal(actual.length, expected.length)
    expected.forEach((value, index) => assert.ok(Math.abs(actual[index] - value) < 1e-9, `${index}: ${actual[index]} vs ${value}`))
  }
  const wave = Array.from({ length: 8 }, (_, x) => 0.25 + Math.cos((2 * Math.PI * 2 * x) / 8))
  near(spectrumOf({ w: 8, h: 1, c: 1, data: wave }).data, [0, 0, 0.5, 0, 0.25, 0, 0.5, 0])
  const stripes = Array.from({ length: 16 }, (_, k) => 3 + Math.cos(Math.PI * (k >> 2)))
  const map = spectrumOf({ w: 4, h: 4, c: 1, data: stripes }).data
  assert.equal(map.length, 16)
  const bin = (x, y) => map[y * 4 + x]
  near([bin(2, 2), bin(2, 0), bin(2, 1), bin(1, 2), bin(2, 3)], [1, 1, 0, 0, 0])
})

test('spectrum maps align signed frequency bins across different image sizes', () => {
  const point = { mode: 'spectrum', source: grid(8, 6), x: 2, y: 4 }
  assert.equal(readFrequency(point, grid(5, 5)), 15)
  assert.equal(readFrequency({ ...point, x: 0 }, grid(5, 5)), undefined)
})

test('row spectra align frequency horizontally and relative row vertically', () => {
  const point = { mode: 'spectrum-rows', source: grid(8, 2), x: 5, y: 1 }
  assert.equal(readFrequency(point, grid(5, 1)), 3)
  assert.equal(readFrequency({ ...point, source: grid(8, 1), y: 0 }, grid(5, 2)), 8)
})
