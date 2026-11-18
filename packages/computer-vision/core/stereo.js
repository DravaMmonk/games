import { boxKernel, correlate, fromFn, shift, zip } from 'image-processing'

export function disparityMap(left, right, window = 3, maxD = 4) {
  const box = boxKernel(window)
  const costs = Array.from({ length: maxD }, (_, d) => correlate(zip(left, shift(right, d, 0), (p, q) => (p - q) ** 2), box))
  return fromFn(left.w, left.h, (x, y) => {
    let best = 0
    for (let d = 1; d < maxD; d++) if (costs[d].data[y * left.w + x] < costs[best].data[y * left.w + x] - 1e-9) best = d
    return best
  })
}
