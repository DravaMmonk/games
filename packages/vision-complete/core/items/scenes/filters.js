// Scenes of filters (scenes/index.js): a noisy step whose true edge is wanted, and the document scanner's scans.

import { addNoise, boxBlur3, correlate, fromFn, gaussianKernel, horizontalDifference, map, squaredGradient } from 'image-processing'
import { patterns } from 'image'

// A 24×24 scan: a sheet of paper on a dark desk, a few lines of text on it, sometimes sensor noise.
const S24 = 24
const DESK = 0.2
const PAPER = 0.85
const INK = 0.3
const sheet = ({ x0, y0, x1, y1, lines = [], noise = 0, seed = 1 }) => {
  const clean = fromFn(S24, S24, (x, y) => {
    if (!(x >= x0 && x <= x1 && y >= y0 && y <= y1)) return DESK
    return lines.some(([lx, ly, len]) => y === ly && x >= lx && x < lx + len) ? INK : PAPER
  })
  return { clean, scan: noise ? addNoise(clean, seed, noise) : clean }
}
// What the scanner is asked for: the scan without its grain, the edges Sobel sees, or the paper's own edges.
const SCAN_EXPECTS = {
  clean: ({ clean }) => correlate(clean, gaussianKernel(1), 'edge'),
  edges: ({ scan }) => map(squaredGradient(scan, 'edge'), (v) => (v > 0.04 ? 1 : 0)),
  paper: ({ scan }) => map(squaredGradient(correlate(scan, gaussianKernel(1.5), 'edge'), 'edge'), (v) => (v > 0.01 ? 1 : 0)),
}

export const FILTERS = {
  noisyStep: {
    make: ({ edge, seed }) => {
      const step = patterns.stepX(edge, 0.15, 0.85)
      return { inputs: { in: addNoise(step, seed, 0.22) }, expected: { out: map(horizontalDifference(boxBlur3(step)), (v) => (v > 0.15 ? 1 : 0)) } }
    },
  },
  scan: {
    make: (test, { expect }) => {
      const made = sheet(test)
      return { inputs: { in: made.scan }, expected: { out: SCAN_EXPECTS[expect](made) } }
    },
  },
}
