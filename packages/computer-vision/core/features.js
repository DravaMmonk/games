import { boxBlur3, fromFn, sobelGradient, zip } from 'image-processing'

export function harrisResponse(a, k = 0.05) {
  const [gx, gy] = sobelGradient(a)
  const xx = boxBlur3(zip(gx, gx, (p, q) => p * q))
  const yy = boxBlur3(zip(gy, gy, (p, q) => p * q))
  const xy = boxBlur3(zip(gx, gy, (p, q) => p * q))
  return fromFn(a.w, a.h, (x, y) => {
    const i = y * a.w + x
    const det = xx.data[i] * yy.data[i] - xy.data[i] * xy.data[i]
    const trace = xx.data[i] + yy.data[i]
    return (det - k * trace * trace) * 100
  })
}

/** The peaks of a response map: cells above `t` that no 3×3 neighbour beats by more than 0.025. */
export const peaksOf = (img, t = 0.3) =>
  fromFn(img.w, img.h, (x, y) => {
    const v = img.data[y * img.w + x]
    if (v <= t) return 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const u = x + dx
        const w = y + dy
        // A neighbour within 0.025 counts as equal, so a flat top keeps all of its cells.
        if (u >= 0 && w >= 0 && u < img.w && w < img.h && img.data[w * img.w + u] > v + 0.025) return 0
      }
    }
    return 1
  })
