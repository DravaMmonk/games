// Scenes of generating pictures (scenes/index.js): a walk between two blobs in latent space, noisy blobs to clean,
// blobs drawn from a latent code at μ + σ·ε, and diffusion: a letter noised in one step or two, restored from its
// noise, and an old photo restored without knowing the noise.
import { GLYPHS, patterns } from 'image'
import { fromFn, image, random, zip, row } from 'imglib'
import { blob, blobAt, encodeBlobCentre } from 'cvlib'
import { gaussian } from 'mllib'

// The latent code μ + σ·ε, drawn as a blob.
const drawn = (mu, sigma, e) => blobAt(mu[0] + sigma[0] * e[0], mu[1] + sigma[1] * e[1])

// Diffusion: x_t = √ᾱ·x₀ + √(1 − ᾱ)·ε, where ᾱ says how much of the picture is left.
const letter = (name, dx = 0, dy = 0) => patterns.glyph(GLYPHS[name], 0.1, 0.9, 3 + dx, 3 + dy)
const noiseImage = (seed) => {
  const next = random(seed)
  return fromFn(16, 16, () => gaussian(next))
}
const addNoiseStep = (x0, eps, ab) => zip(x0, eps, (x, e) => Math.sqrt(ab) * x + Math.sqrt(1 - ab) * e)

export const GENERATIVE = {
  walk: {
    make: ({ a: [ax, ay], b: [bx, by], t: w }) => {
      const a = blob(ax, ay)
      const b = blob(bx, by)
      const [za, zb] = [encodeBlobCentre(a).data, encodeBlobCentre(b).data]
      return { inputs: { a, b, t: image(1, 1, w) }, expected: { out: blobAt((1 - w) * za[0] + w * zb[0], (1 - w) * za[1] + w * zb[1]) } }
    },
  },
  noisyBlob: {
    make: ({ at: [x, y], seed }) => {
      const clean = blob(x, y)
      const next = random(seed)
      return { inputs: { in: fromFn(16, 16, (px, py) => clean.data[py * 16 + px] + 0.12 * (next() + next() + next() - 1.5) * 2) }, expected: { out: clean } }
    },
  },
  latent: {
    make: ({ eps }, { mu, sigma, given }) => ({ inputs: { eps: row(eps), ...(given ? { mu: row(mu), sigma: row(sigma) } : {}) }, expected: { out: drawn(mu, sigma, eps) } }),
  },
  sides: {
    make: ({ eps, c }, { left, right, sigma }) => ({
      inputs: { eps: row(eps), c: image(1, 1, c), left: row(left), right: row(right), sigma: row(sigma) },
      expected: { out: drawn(c ? right : left, sigma, eps) },
    }),
  },
  noising: {
    make: ({ letter: name, seed, ab }) => ({ inputs: { x0: letter(name), eps: noiseImage(seed), ab: image(1, 1, ab) }, expected: { out: addNoiseStep(letter(name), noiseImage(seed), ab) } }),
  },
  twoNoisings: {
    make: ({ letter: name, seeds: [s1, s2], ab: [a1, a2] }) => {
      const once = addNoiseStep(letter(name), noiseImage(s1), a1)
      return { inputs: { x0: letter(name), e1: noiseImage(s1), e2: noiseImage(s2), a1: image(1, 1, a1), a2: image(1, 1, a2) }, expected: { out: addNoiseStep(once, noiseImage(s2), a2) } }
    },
  },
  restoring: {
    make: ({ letter: name, seed, ab }) => ({ inputs: { xt: addNoiseStep(letter(name), noiseImage(seed), ab), eps: noiseImage(seed), ab: image(1, 1, ab) }, expected: { out: letter(name) } }),
  },
  oldPhoto: {
    make: ({ letter: name, dx, dy, seed }, { ab }) => {
      const x0 = letter(name, dx, dy)
      return { inputs: { xt: addNoiseStep(x0, noiseImage(seed), ab), ab: image(1, 1, ab) }, expected: { x0, ink: fromFn(16, 16, (x, y) => (x0.data[y * 16 + x] > 0.5 ? 1 : 0)) } }
    },
  },
}
