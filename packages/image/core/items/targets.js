import { qualifyItems } from 'kernel'
// What a circuit is asked to make of one picture (vocabulary.js target), for the scene of a picture in and the
// picture a rule makes of it out (scenes/index.js filter). Each item is make(params) → (picture) → the expected one.
import { callOf } from 'kernel'
import { applyGain, boxBlur3, boxKernel, correlate, downsample, flipKernel, fromFn, gaussianKernel, gradientMagnitude, highpass, horizontalDifference, image, lowpass, magnitudeSpectrum, map, row, shift, squaredGradient, zeroUp, zip } from 'imglib'
import { cross3, harrisResponse, peaksOf } from 'cvlib'
import { attentionWeights } from 'mllib'

const cross = (a, b) => row(cross3(a.data, b.data))
// Every cell's distance from the centre of a spectrum the size of `img` (frequency (0, 0)).
const radiusOf = (img) => fromFn(img.w, img.h, (x, y) => Math.hypot(x - img.w / 2, y - img.h / 2))

export const TARGETS = qualifyItems('image', {
  same: {
    make: () => (img) => img,
  },
  shift: {
    make: ({ dx, dy, border }) => (img) => shift(img, dx, dy, border),
  },
  negative: {
    make: () => (img) => map(img, (v) => 1 - v),
  },
  correlate: {
    make: ({ kernel, border }) => (img) => correlate(img, kernel, border),
  },
  convolve: {
    make: ({ kernel }) => (img) => correlate(img, flipKernel(kernel)),
  },
  box: {
    make: ({ size, border }) => (img) => correlate(img, boxKernel(size), border),
  },
  gauss: {
    make: ({ sigma, radius, border }) => (img) => correlate(img, gaussianKernel(sigma, radius), border),
  },
  sharpen: {
    make: ({ sigma, amount }) => (img) => zip(img, correlate(img, gaussianKernel(sigma)), (a, b) => a + amount * (a - b)),
  },
  diffx: {
    make: () => horizontalDifference,
  },
  absdiff: {
    make: () => (img) => map(horizontalDifference(img), Math.abs),
  },
  max: {
    make: () => (a, b) => zip(a, b, Math.max),
  },
  stride: {
    make: ({ kernel }) => (img) => downsample(correlate(img, kernel), 2),
  },
  meanBlend: {
    make: ({ amount }) => (img) => zip(img, boxBlur3(img), (a, b) => a + amount * (b - a)),
  },
  ask: {
    make: () => (a, b) => {
      const [wa, wb] = attentionWeights(a.data, [a.data, b.data], 1)
      return zip(a, b, (x, y) => wa * x + wb * y)
    },
  },
  projectedAsk: {
    make: () => (a, b) => {
      const q = a.data.map(x => x * 1.8)
      const keys = [a, b].map(img => img.data.map(x => x * 1.2))
      const [wa, wb] = attentionWeights(q, keys)
      return zip(a, b, (x, y) => 0.9 * (wa * x + wb * y))
    },
  },
  gradientEnergy: {
    make: () => (img) => boxBlur3(squaredGradient(img)),
  },
  cornerResponse: {
    make: () => (img) => harrisResponse(img),
  },
  corners: {
    make: ({ threshold }) => (img) => map(harrisResponse(img), (v) => (v > threshold ? 1 : 0)),
  },
  cornerPeaks: {
    make: ({ gain, above }) => (img) => peaksOf(map(harrisResponse(img), (v) => v * gain), above),
  },
  upsample: {
    make: ({ kernel }) => (img) => correlate(zeroUp(img), kernel),
  },
  cross: {
    make: () => cross,
  },
  meet: {
    make: () => (p, q, r, s) => cross(cross(p, q), cross(r, s)),
  },
  gradmag: {
    make: ({ border }) => (img) => gradientMagnitude(img, border),
  },
  lowpass: {
    make: ({ shape, R }) => (img) => lowpass(img, shape, R),
  },
  sharpness: {
    make: ({ beyond }) => (img) => {
      const s = magnitudeSpectrum(img)
      const r = radiusOf(img)
      return image(1, 1, s.data.reduce((sum, v, i) => sum + (r.data[i] > beyond ? v : 0), 0) / s.data.length)
    },
  },
  descreen: {
    make: ({ threshold, radius }) => (img) => {
      const s = magnitudeSpectrum(img)
      const r = radiusOf(img)
      return applyGain(img, fromFn(img.w, img.h, (x, y) => (s.data[y * img.w + x] > threshold && r.data[y * img.w + x] > radius ? 0 : 1)))
    },
  },
  hybrid: {
    make: ({ R }) => (a, b) => zip(lowpass(a, 'gauss', R), highpass(b, 'gauss', R), (p, q) => p + q),
  },
  shrink: {
    make: ({ sigma, halvings }) => (img) => {
      let out = correlate(img, gaussianKernel(sigma), 'edge')
      for (let i = 0; i < halvings; i++) out = downsample(out, 2)
      return out
    },
  },
  pyramid: {
    make: ({ levels }) => (img) => {
      let out = img
      for (let i = 0; i < levels; i++) out = downsample(correlate(out, gaussianKernel(1), 'edge'), 2)
      return out
    },
  },
})

/** A target as the function from a test's picture to the picture expected. */
export function targetOf(call) {
  const [name, params] = callOf(call)
  return TARGETS[name].make(params)
}
