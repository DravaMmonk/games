import { qualifyItems } from 'kernel'
// The pictures content names (vocabulary.js picture): the test-picture library (./patterns.js) with its
// parameters by name, a few drawn at any size, and pictures made from another (a noisy copy, a blurred one). A
// picture is written { name: params } or, with every parameter left at its default, by its name alone; a test, a
// probe, an intro figure, a bench or a scene names one. Pictures are 16 × 16 unless they say their size.
import { callOf } from 'kernel'
import { GLYPHS, patterns } from './patterns.js'
import { SIZE, addNoise, correlate, fromFn, gaussianKernel, map, random, zip } from 'imglib'
import { blob } from 'cvlib'

const TAU = 2 * Math.PI
/** A letter of the library (GLYPHS), or rows of '#' and '.' drawn the same way. */
const rowsOf = ({ letter, rows }) => rows ?? GLYPHS[letter]
/** The 4 × 4 patterns the attention scenes compare (a picture of one is `tile`). */
export const TILES = {
  X: ['#..#', '.##.', '.##.', '#..#'],
  C: ['####', '#...', '#...', '#...'],
  P: ['.#..', '####', '.#..', '.#..'],
  K: ['##..', '##..', '..##', '..##'],
  R: ['.##.', '#..#', '#..#', '.##.'],
  S: ['#...', '##..', '###.', '####'],
}

// A pattern of the library: its parameters are its arguments by name, in order (all optional: its defaults stand in).
const pattern = (name, args) => ({
  make: (p) => patterns[name](...args.map((a) => p[a])),
})

export const PICTURES = qualifyItems('image', {
  blank: pattern('blank', ['v']),
  impulse: {
    make: ({ x: px = 7, y: py = 7, v = 1, size: n = SIZE }) => fromFn(n, n, (x, y) => (x === px && y === py ? v : 0)),
  },
  dots: {
    make: ({ dots }) => fromFn(SIZE, SIZE, (x, y) => dots.find(([px, py]) => px === x && py === y)?.[2] ?? 0),
  },
  diagonal: {
    make: ({ lo = 0.1, hi = 0.9, size: n = SIZE }) => fromFn(n, n, (x, y) => (x === y ? hi : lo)),
  },
  stepX: pattern('stepX', ['edge', 'lo', 'hi']),
  stepY: pattern('stepY', ['edge', 'lo', 'hi']),
  rampX: {
    make: ({ size: n = SIZE }) => fromFn(n, n, (x) => x / (n - 1)),
  },
  rampY: {
    make: () => fromFn(SIZE, SIZE, (x, y) => y / (SIZE - 1)),
  },
  ramp: {
    make: ({ c = 0, dx = 0, dy = 0 }) => fromFn(SIZE, SIZE, (x, y) => c + dx * x + dy * y),
  },
  bar: {
    make: ({ x: at, lo = 0.1, hi = 0.9 }) => fromFn(SIZE, SIZE, (x) => (x === at ? hi : lo)),
  },
  square: pattern('square', ['x0', 'y0', 's', 'lo', 'hi']),
  rect: {
    make: ({ x0, y0, w, h, lo = 0.1, hi = 0.9, size: n = SIZE }) => fromFn(n, n, (x, y) => (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h ? hi : lo)),
  },
  rects: {
    make: ({ rects, lo = 0.1, hi = 0.9, size: n = SIZE }) => fromFn(n, n, (x, y) => (rects.some(([x0, y0, w, h]) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) ? hi : lo)),
  },
  disk: {
    make: ({ cx = 7.5, cy = 7.5, r = 5, lo = 0.1, hi = 0.9, size: n = SIZE }) => fromFn(n, n, (x, y) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r ? hi : lo)),
  },
  discs: {
    make: ({ discs, lo = 0.1, hi = 0.9, size: n = SIZE }) => fromFn(n, n, (x, y) => (discs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r) ? hi : lo)),
  },
  checker: {
    make: ({ cell = 4, lo = 0.1, hi = 0.9, size: n = SIZE }) => fromFn(n, n, (x, y) => ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? hi : lo)),
  },
  stripes: {
    make: ({ period = 4, lo = 0.1, hi = 0.9, w = SIZE, h = SIZE, axis = 'x' }) => fromFn(w, h, (x, y) => (Math.floor(((axis === 'x' ? x : y) * 2) / period) % 2 ? hi : lo)),
  },
  corner: pattern('corner', ['x0', 'y0', 'lo', 'hi']),
  speckle: {
    make: ({ seed, base, amp }) => {
      const next = random(seed)
      return fromFn(SIZE, SIZE, () => base + amp * next())
    },
  },
  twoTone: {
    make: ({ seed, dark, bright, disc, rightOf, stripes }) => {
      const share = disc ? (x, y) => ((x - disc[0]) ** 2 + (y - disc[1]) ** 2 < disc[2] ? 1 : 0) : rightOf !== undefined ? (x) => (x > rightOf ? 1 : 0) : (x, y) => ((x + y) % stripes[0] < stripes[1] ? 1 : 0)
      const next = random(seed)
      return fromFn(SIZE, SIZE, (x, y) => (next() < share(x, y) ? bright + 0.1 * (next() - 0.5) : dark + 0.1 * (next() - 0.5)))
    },
  },
  noise: pattern('noise', ['seed', 'amp']),
  zonePlate: {
    make: ({ k = 0.06, size: n = 32, cx = n / 2, cy = n / 2, A = 0.5 }) => fromFn(n, n, (x, y) => 0.5 + A * Math.cos(k * ((x - cx) ** 2 + (y - cy) ** 2))),
  },
  fabric: {
    make: ({ period, angle, size: n = 32 }) => {
      const a = (angle * Math.PI) / 180
      return fromFn(n, n, (x, y) => 0.5 + 0.35 * Math.cos((TAU * (x * Math.cos(a) + y * Math.sin(a))) / period))
    },
  },
  glyph: {
    make: ({ lo = 0.1, hi = 0.9, ox = 3, oy = 3, scale = 2, size: n = SIZE, ...p }) => {
      const rows = rowsOf(p)
      return fromFn(n, n, (x, y) => (rows[Math.floor((y - oy) / scale)]?.[Math.floor((x - ox) / scale)] === '#' ? hi : lo))
    },
  },
  row: {
    make: ({ values }) => fromFn(values.length, 1, (x) => values[x]),
  },
  blob: {
    make: ({ x, y }) => blob(x, y),
  },
  tile: {
    make: ({ name, hi = 1 }) => fromFn(4, 4, (x, y) => (TILES[name][y][x] === '#' ? hi : 0)),
  },
  radius: {
    make: ({ size: n = 32 }) => fromFn(n, n, (x, y) => Math.hypot(x - n / 2, y - n / 2)),
  },
  offset: {
    make: ({ of: inner, by }) => map(picture(inner), (v) => v + by),
  },
  scaled: {
    make: ({ of: inner, size: n }) => {
      const img = picture(inner)
      return fromFn(n, n, (x, y) => img.data[Math.floor((y * 16) / n) * 16 + Math.floor((x * 16) / n)])
    },
  },
  margined: {
    make: ({ of: inner, width }) => {
      const img = picture(inner)
      return fromFn(img.w, img.h, (x, y) => (x < width || y < width || x >= img.w - width || y >= img.h - width ? 0 : img.data[y * img.w + x]))
    },
  },
  noisy: {
    make: ({ of: inner, seed, amp }) => addNoise(picture(inner), seed, amp),
  },
  blurred: {
    make: ({ of: inner, sigma }) => (sigma ? correlate(picture(inner), gaussianKernel(sigma), 'edge') : picture(inner)),
  },
  screened: {
    make: ({ of: inner, fx, fy }) => {
      const img = picture(inner)
      const grating = fromFn(img.w, img.h, (x, y) => 0.5 + 0.12 * Math.cos((2 * Math.PI * (fx * x + fy * y)) / img.w))
      return zip(img, grating, (p, q) => p + q - 0.5)
    },
  },
})

/** The picture a call names. */
export function picture(call) {
  const [name, params] = callOf(call)
  const item = PICTURES[name]
  if (!item) throw new Error(`no picture ${name}`)
  return item.make(params)
}
