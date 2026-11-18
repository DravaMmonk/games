// Scenes of detection (scenes/index.js): two boxes and how much they overlap, ranked lists of detections into AP,
// anchor boxes and their corrections, X- and O-marked boxes on a shelf, and dogs as solid blobs.

import { correlate, fromFn, gaussianKernel, image, random, zip, row } from 'imglib'

const num = (v) => image(1, 1, v)

const boxMask = ([x0, y0, x1, y1]) => fromFn(16, 16, (x, y) => (x >= x0 && x < x1 && y >= y0 && y < y1 ? 1 : 0))
const iou = (a, b) => {
  let inter = 0
  let sa = 0
  let sb = 0
  for (let i = 0; i < a.data.length; i++) {
    inter += a.data[i] * b.data[i]
    sa += a.data[i]
    sb += b.data[i]
  }
  return inter / (sa + sb - inter)
}
const BOX_EXPECTS = {
  iou: (a, b) => ({ out: num(iou(a, b)) }),
  good: (a, b) => ({ ok: num(iou(a, b) > 0.5 ? 1 : 0) }),
}

// Detections sorted by score, each right (1) or wrong (0); AP = the precision at each right one, added up, over the
// number of labelled objects G.
const N = 16
const ap = (flags, g) => {
  let right = 0
  let sum = 0
  flags.forEach((f, k) => {
    right += f
    if (f) sum += right / (k + 1)
  })
  return sum / g
}
const RANKS = row(Array.from({ length: N }, (_, k) => k + 1))

// An anchor (cx, cy, w, h) and the corrections (tx, ty, tw, th): the box is centred at cx + tx·w, cy + ty·h, w·e^tw
// by h·e^th.
const nudge = (v) => ({ bx: v.cx + v.tx * v.w, by: v.cy + v.ty * v.h, bw: v.w * Math.exp(v.tw), bh: v.h * Math.exp(v.th) })

// Marks on a shelf: 3 × 3 X and O, at twice the size when large (centred on an odd pixel, so each of their cells is a
// 2 × 2 block).
const X3 = ['#.#', '.#.', '#.#']
const O3 = ['###', '#.#', '###']
const stamp = (w, h, marks) =>
  fromFn(w, h, (x, y) => {
    for (const { mark, at: [cx, cy], scale: s = 1 } of marks) {
      const u = Math.floor((x - cx) / s + 1.5)
      const v = Math.floor((y - cy) / s + 1.5)
      if (u >= 0 && u < 3 && v >= 0 && v < 3 && x - cx >= -1.5 * s && x - cx < 1.5 * s && y - cy >= -1.5 * s && y - cy < 1.5 * s) return (mark === 'X' ? X3 : O3)[v][u] === '#' ? 0.9 : 0.1
    }
    return 0.1
  })

const smallCentres = (marks, w) => fromFn(w, w, (x, y) => (marks.some(({ mark, at: [cx, cy], scale = 1 }) => mark === 'X' && scale === 1 && cx === x && cy === y) ? 1 : 0))
const bigCentres = (marks, w) => fromFn(w, w, (x, y) => (marks.some(({ mark, at: [cx, cy], scale = 1 }) => mark === 'X' && scale === 2 && (x >> 1) === cx >> 1 && (y >> 1) === cy >> 1) ? 1 : 0))
const SHELF_EXPECTS = {
  small: (marks, w) => smallCentres(marks, w),
  both: (marks, w) => zip(smallCentres(marks, w), bigCentres(marks, w), Math.max),
}
const grain = (img, seed, amp) => {
  const next = random(seed)
  return zip(img, img, (v) => v + amp * (next() - 0.5) * 2)
}

export const DETECT = {
  boxPair: {
    make: ({ a, b }, { expect }) => ({ inputs: { a: boxMask(a), b: boxMask(b) }, expected: BOX_EXPECTS[expect](boxMask(a), boxMask(b)) }),
  },
  ranking: {
    make: ({ flags, g }) => ({ inputs: { f: row(flags), k: RANKS, g: num(g) }, expected: { out: num(ap(flags, g)) } }),
  },
  twoRankings: {
    make: ({ one, two }) => ({ inputs: { f1: row(one.flags), g1: num(one.g), f2: row(two.flags), g2: num(two.g), k: RANKS }, expected: { out: num((ap(one.flags, one.g) + ap(two.flags, two.g)) / 2) } }),
  },
  nudge: {
    make: ({ anchors, t: c }) => {
      const pick = (key) => row(anchors.map((a) => a[key]))
      const boxes = anchors.map((a) => nudge({ ...a, ...c }))
      return { inputs: { cx: pick('cx'), cy: pick('cy'), w: pick('w'), h: pick('h'), tx: num(c.tx), ty: num(c.ty), tw: num(c.tw), th: num(c.th) }, expected: Object.fromEntries(['bx', 'by', 'bw', 'bh'].map((k) => [k, row(boxes.map((b) => b[k]))])) }
    },
  },
  marks: {
    make: ({ marks }) => ({ inputs: { in: stamp(16, 16, marks) }, expected: { out: smallCentres(marks, 16) } }),
  },
  shelf: {
    make: ({ marks, seed }, { expect, grain: amp, blur }) => {
      const drawn = stamp(24, 24, marks)
      const soft = blur ? correlate(drawn, gaussianKernel(blur), 'edge') : drawn
      return { inputs: { in: amp ? grain(soft, seed, amp) : soft }, expected: { out: SHELF_EXPECTS[expect](marks, 24) } }
    },
  },
  dogs: {
    make: ({ dogs }) => ({
      inputs: { in: correlate(fromFn(16, 16, (x, y) => (dogs.some(([cx, cy]) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1) ? 0.9 : 0.1)), gaussianKernel(0.8), 'edge') },
      expected: { out: fromFn(16, 16, (x, y) => (dogs.some(([cx, cy]) => cx === x && cy === y) ? 1 : 0)) },
    }),
  },
}
