// Scenes of attention (scenes/index.js): pictures of 4 × 4 patterns with a few pixels erased from one copy, two such
// pictures at once, a bright and a dark patch in reading order, patterns at several brightnesses, and photos to match
// with their altered copies.

import { fromFn, image } from 'image-processing'
import { TILES, picture } from 'image'

// Patterns placed on a 16 × 16 picture, each pattern pixel `scale` cells wide (4 patterns to a row at scale 1, 2 at
// scale 2), a few pixels of one copy erased.

const placed = (items, scale = 1, erase = true) =>
  fromFn(16, 16, (x, y) => {
    const size = 4 * scale
    for (const { tile: name, at: [row, col], erased = [] } of items) {
      if (Math.floor(x / size) !== col || Math.floor(y / size) !== row) continue
      const u = scale === 1 ? x % 4 : (x % size) >> 1
      const v = scale === 1 ? y % 4 : (y % size) >> 1
      if (erase && erased.some(([eu, ev]) => eu === u && ev === v)) return 0
      return TILES[name][v][u] === '#' ? 1 : 0
    }
    return 0
  })
// Patterns lit at a brightness each.

const lit = (items) =>
  fromFn(16, 16, (x, y) => {
    for (const { tile: name, at: [row, col], hi } of items) if (Math.floor(x / 4) === col && Math.floor(y / 4) === row) return TILES[name][y % 4][x % 4] === '#' ? hi : 0
    return 0
  })
const brightest = (items) => {
  const ink = (item) => TILES[item.tile].join('').split('#').length * item.hi
  const best = items.reduce((a, b) => (ink(b) > ink(a) ? b : a))
  return fromFn(16, 16, (x, y) => (TILES[best.tile][y % 4][x % 4] === '#' ? best.hi : 0))
}
// Each pixel's patch number in reading order, 0 … 15.
const PATCH_NUMBER = fromFn(16, 16, (x, y) => Math.floor(y / 4) * 4 + Math.floor(x / 4))
const orderScene = (bright, dark) => fromFn(16, 16, (x, y) => {
  const i = Math.floor(y / 4) * 4 + Math.floor(x / 4)
  return i === bright ? 0.9 : i === dark ? 0.1 : 0.5
})
const one = (yes) => image(1, 1, yes ? 1 : 0)

export const ATTENTION = {
  mend: {
    make: ({ items }, { scale = 1 }) => ({ inputs: { in: placed(items, scale) }, expected: { out: placed(items, scale, false) } }),
  },
  mendTwo: {
    make: ({ shape, mark }) => ({ inputs: { shape: placed(shape), mark: placed(mark) }, expected: { so: placed(shape, 1, false), mo: placed(mark, 1, false) } }),
  },
  order: {
    make: ({ bright, dark }) => ({ inputs: { in: orderScene(bright, dark), pos: PATCH_NUMBER }, expected: { out: fromFn(16, 16, () => (bright < dark ? 1 : 0)) } }),
  },
  brightest: {
    make: ({ items }) => ({ inputs: { in: lit(items) }, expected: { out: brightest(items) } }),
  },
  nearest: {
    make: ({ q, candidates, which }) => {
      const [a, b, c] = candidates.map(picture)
      return { inputs: { q: picture(q), a, b, c }, expected: { pa: one(which === 0), pb: one(which === 1), pc: one(which === 2) } }
    },
  },
  duplicate: {
    make: ({ a, b, same }) => ({ inputs: { a: picture(a), b: picture(b) }, expected: { same: one(same) } }),
  },
}
