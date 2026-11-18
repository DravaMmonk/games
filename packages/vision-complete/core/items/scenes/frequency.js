// Scenes of frequency (scenes/index.js): a waveform made of a few waves, read for one of them; a photo under fine
// grain, the photo gently blurred expected.

import { correlate, cosine, fromFn, gaussianKernel, highpass, image, map, random, row, sampleAt, zip } from 'imglib'
import { picture } from 'image'

const N = 32
// Fine-grained noise: random values with everything below 10 cycles per image removed, std 0.07.
const fineNoise = (seed, std = 0.07) => {
  const next = random(seed)
  const raw = highpass(fromFn(N, N, () => next() - 0.5), 'disk', 10)
  const rms = Math.sqrt(raw.data.reduce((sum, v) => sum + v * v, 0) / raw.data.length)
  return map(raw, (v) => (v * std) / rms)
}

export const FREQUENCY = {
  waveform: {
    make: ({ c, waves }, { k }) => ({
      inputs: { in: waves.reduce((sum, w) => zip(sum, row(sampleAt(cosine(w), N)), (p, q) => p + q), image(N, 1, c)) },
      expected: { out: image(1, 1, waves.find((w) => w.k === k)?.A ?? 0) },
    }),
  },
  grainy: {
    make: ({ photo, seed }) => {
      const img = picture(photo)
      return { inputs: { in: zip(img, fineNoise(seed), (p, q) => p + q) }, expected: { out: correlate(img, gaussianKernel(1), 'edge') } }
    },
  },
}
