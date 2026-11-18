// Scenes of per-pixel work (scenes/index.js): a washed-out photo, an intruder against an empty scene, the inspection
// station that compares a part with its reference.

import { fromFn, map } from 'imglib'
import { picture } from 'image'

const box = (x0, y0, w, h) => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h
const inRects = (rects) => (x, y) => rects.some(([x0, y0, w, h]) => box(x0, y0, w, h)(x, y))
const maskOf = (inside) => fromFn(16, 16, (x, y) => (inside(x, y) ? 1 : 0))

// The intruder scenes: a floor lit unevenly (a slope across, and on even seeds down too), the intruder 0.3 brighter.
const unevenFloor = (seed) => fromFn(16, 16, (x, y) => 0.15 + 0.5 * (x / 15) * (seed % 2 ? 1 : y / 15))
// A floor of faint tiles, the intruder 0.4 brighter.
const tiledFloor = (seed) => fromFn(16, 16, (x, y) => 0.2 + 0.25 * ((x + 2 * y + seed) % 5) / 4)

// The station's parts under its lamp: the reference as photographed, the part on the belt with its defects (dents
// darker, shiny scratches brighter).
const PARTS = {
  plate: (x, y) => (box(2, 2, 12, 12)(x, y) ? 0.85 : 0.3),
  ring: (x, y) => ((x - 7.5) ** 2 + (y - 7.5) ** 2 <= 36 && (x - 7.5) ** 2 + (y - 7.5) ** 2 >= 6 ? 0.95 : 0.3),
  bracket: (x, y) => (box(2, 2, 4, 12)(x, y) || box(2, 10, 12, 4)(x, y) ? 0.95 : 0.3),
  gear: (x, y) => (box(3, 3, 10, 10)(x, y) || ((x === 1 || x === 14) && y % 4 < 2) || ((y === 1 || y === 14) && x % 4 < 2) ? 0.8 : 0.3),
  tile: (x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 0.95 : 0.3),
}
const DEFECT = 0.15

export const PIXELS = {
  washedOut: {
    make: ({ photo }) => {
      const img = picture(photo)
      return { inputs: { in: map(img, (v) => 0.25 + 0.5 * v) }, expected: { out: img } }
    },
  },
  intruder: {
    make: ({ x: x0, y: y0, seed }) => {
      const bg = unevenFloor(seed)
      const scene = fromFn(16, 16, (x, y) => bg.data[y * 16 + x] + (box(x0, y0, 4, 4)(x, y) ? 0.3 : 0))
      return { inputs: { scene, empty: bg }, expected: { out: maskOf(box(x0, y0, 4, 4)) } }
    },
  },
  outline: {
    make: ({ shape, seed }) => {
      const inside = inRects(shape)
      const bg = tiledFloor(seed)
      const scene = fromFn(16, 16, (x, y) => bg.data[y * 16 + x] + (inside(x, y) ? 0.4 : 0))
      const isIn = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && inside(x, y)
      const ring = maskOf((x, y) => isIn(x, y) && !(isIn(x - 1, y) && isIn(x + 1, y) && isIn(x, y - 1) && isIn(x, y + 1)))
      return { inputs: { scene, empty: bg }, expected: { out: ring } }
    },
  },
  station: {
    make: ({ part, dents = [], scratches = [], lamp = 1 }) => {
      const ref = fromFn(16, 16, PARTS[part])
      const dent = inRects(dents)
      const scratch = inRects(scratches)
      const actual = fromFn(16, 16, (x, y) => lamp * (PARTS[part](x, y) - (dent(x, y) ? DEFECT : 0) + (scratch(x, y) ? DEFECT : 0)))
      return { inputs: { ref, part: actual }, expected: { out: maskOf((x, y) => dent(x, y) || scratch(x, y)) } }
    },
  },
}
