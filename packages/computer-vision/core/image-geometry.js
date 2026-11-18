import { fromFn } from 'image-processing'
import { houghAccumulate, invert3, project } from './match.js'

export const HOUGH_BINS = 16

export const pointsOf = (img) => {
  const points = []
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[y * img.w + x] > 0.5) points.push([x, y])
  return points
}
export function houghGrid(img) {
  const { nT, nR, votes } = houghAccumulate(pointsOf(img), 180 / HOUGH_BINS, 2, Math.ceil(Math.hypot(img.w, img.h)))
  return { w: nT, h: nR, data: votes }
}

// Pairs of points as a row of x, y, x′, y′ four at a time.
export const pairsOf = (signal) => Array.from({ length: Math.floor(signal.w / 4) }, (_, i) => ({ from: [signal.data[4 * i], signal.data[4 * i + 1]], to: [signal.data[4 * i + 2], signal.data[4 * i + 3]] }))
// The picture `onto` with `img` carried there by H, sampling the nearest pixel; 0 where it falls outside `img`.
export function warp(img, H, onto) {
  const back = invert3(H)
  return fromFn(onto.w, onto.h, (x, y) => {
    if (!back) return 0
    const [u, v] = project(back, x, y).map(Math.round)
    return u >= 0 && v >= 0 && u < img.w && v < img.h ? img.data[v * img.w + u] : 0
  })
}
