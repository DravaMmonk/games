import { fromFn, image, random, SIZE } from 'imglib'

export const patterns = {
  blank: (v = 0) => image(SIZE, SIZE, v),
  impulse: (x = 7, y = 7, v = 1) => fromFn(SIZE, SIZE, (px, py) => (px === x && py === y ? v : 0)),
  stepX: (edge = 8, lo = 0.15, hi = 0.85) => fromFn(SIZE, SIZE, (x) => (x < edge ? lo : hi)),
  stepY: (edge = 8, lo = 0.15, hi = 0.85) => fromFn(SIZE, SIZE, (x, y) => (y < edge ? lo : hi)),
  rampX: () => fromFn(SIZE, SIZE, (x) => x / (SIZE - 1)),
  square: (x0 = 4, y0 = 4, s = 8, lo = 0.1, hi = 0.9) => fromFn(SIZE, SIZE, (x, y) => (x >= x0 && x < x0 + s && y >= y0 && y < y0 + s ? hi : lo)),
  disk: (cx = 7.5, cy = 7.5, r = 5, lo = 0.1, hi = 0.9) => fromFn(SIZE, SIZE, (x, y) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r ? hi : lo)),
  checker: (cell = 4, lo = 0.1, hi = 0.9) => fromFn(SIZE, SIZE, (x, y) => ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? hi : lo)),
  stripes: (period = 4, lo = 0.1, hi = 0.9, w = SIZE, h = SIZE) => fromFn(w, h, (x) => (Math.floor((x * 2) / period) % 2 ? hi : lo)),
  corner: (x0 = 6, y0 = 6, lo = 0.1, hi = 0.9) => fromFn(SIZE, SIZE, (x, y) => (x >= x0 && y >= y0 ? hi : lo)),
  noise: (seed = 1, amp = 1) => {
    const next = random(seed)
    return fromFn(SIZE, SIZE, () => next() * amp)
  },
  zonePlate: (w = 32, h = 32, k = 0.06) => fromFn(w, h, (x, y) => 0.5 + 0.5 * Math.cos(k * ((x - w / 2) ** 2 + (y - h / 2) ** 2))),
  glyph: (rows, lo = 0.1, hi = 0.9, ox = 3, oy = 3, scale = 2) =>
    fromFn(SIZE, SIZE, (x, y) => {
      const gx = Math.floor((x - ox) / scale)
      const gy = Math.floor((y - oy) / scale)
      return rows[gy]?.[gx] === '#' ? hi : lo
    }),
}

export const GLYPHS = {
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  F: ['#####', '#....', '####.', '#....', '#....'],
}
