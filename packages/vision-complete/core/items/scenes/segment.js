// Scenes of labelling every pixel (scenes/index.js): a picture before and after max pooling, two-means on a
// picture's brightness, and cells under a microscope.

import { fromFn, image, maxPool, random } from 'imglib'
import { picture } from 'image'

// 2 × 2 blocks, one cell of each clearly the brightest.
function blocky(seed) {
  const next = random(seed)
  const img = image(16, 16)
  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      const win = Math.floor(next() * 4)
      for (let k = 0; k < 4; k++) img.data[(2 * by + (k >> 1)) * 16 + 2 * bx + (k & 1)] = k === win ? 0.7 + 0.25 * next() : 0.1 + 0.5 * next()
    }
  }
  return img
}
// Max unpooling: each pooled value back in the cell it came from, the rest of its 2 × 2 block 0.
const unpooled = (big) => {
  const small = maxPool(big, 2)
  return fromFn(16, 16, (x, y) => (big.data[y * 16 + x] === small.data[(y >> 1) * 8 + (x >> 1)] ? big.data[y * 16 + x] : 0))
}

// Two-means on brightness, kept as the boundary m between the two centres: the new boundary is halfway between the
// averages of the values above m and of the rest.
const kmeansStep = (img, m) => {
  let hi = 0
  let nh = 0
  let lo = 0
  let nl = 0
  for (const v of img.data) {
    if (v > m) {
      hi += v
      nh++
    } else {
      lo += v
      nl++
    }
  }
  return (hi / nh + lo / nl) / 2
}
const KMEANS_EXPECTS = {
  step: (img, m) => ({ out: image(1, 1, kmeansStep(img, m)) }),
  segment: (img, m0) => {
    let m = m0
    for (let i = 0; i < 3; i++) m = kmeansStep(img, m)
    return { out: fromFn(16, 16, (x, y) => (img.data[y * 16 + x] > m ? 1 : 0)) }
  },
}

// Bright cells on a darker background, with grain; rectangles [x0, y0, x1, y1], one-pixel gaps on the columns and
// rows listed.
function cells(seed, inside, { cell = 0.8, back = 0.2, grain = 0.4 } = {}) {
  const next = random(seed)
  const img = fromFn(16, 16, (x, y) => (inside(x, y) ? cell : back) + grain * (next() - 0.5) * 2)
  return { img, mask: fromFn(16, 16, (x, y) => (inside(x, y) ? 1 : 0)) }
}

export const SEGMENT = {
  pooled: {
    make: ({ seed }) => ({ inputs: { small: maxPool(blocky(seed), 2), big: blocky(seed) }, expected: { out: unpooled(blocky(seed)) } }),
  },
  kmeans: {
    make: ({ img, m }, { expect }) => {
      const pic = picture(img)
      return { inputs: { img: pic, m: image(1, 1, m) }, expected: KMEANS_EXPECTS[expect](pic, m) }
    },
  },
  cells: {
    make: ({ rects, gapX = [], gapY = [], seed, cell, back, grain }) => {
      const inside = (x, y) => rects.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1) && !gapX.includes(x) && !gapY.includes(y)
      const made = cells(seed, inside, { cell, back, grain })
      return { inputs: { in: made.img }, expected: { out: made.mask } }
    },
  },
}
