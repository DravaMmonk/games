import { fromFn, random, row } from 'image-processing'

const BLOB_SIGMA = 1.6
const UNIT = 4 // one latent unit moves the blob 4 pixels
export const blob = (px, py) => fromFn(16, 16, (x, y) => Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * BLOB_SIGMA * BLOB_SIGMA)))
export const blobAt = (zx, zy) => blob(7.5 + UNIT * zx, 7.5 + UNIT * zy)

// The encoder reads the image's column and row profiles in 8 bins each (two columns or rows per bin)
// and keeps k numbers: z_j = Σ a_j·columns + Σ b_j·rows. Weights for up to 3 numbers, 16 per number.
const MAX_CODE = 3
function profiles(img) {
  const bins = Array(16).fill(0)
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const v = img.data[y * img.w + x] / img.w
      bins[Math.floor((x * 8) / img.w)] += v
      bins[8 + Math.floor((y * 8) / img.h)] += v
    }
  }
  return bins
}
export function encode(img, w, k) {
  if (img.w !== 16 || img.h !== 16) throw new Error('编码器要一张 16×16 的图')
  const bins = profiles(img)
  return row(Array.from({ length: k }, (_, j) => bins.reduce((sum, b, i) => sum + b * w[j * 16 + i], 0)))
}
// The decoder draws one blob; where it goes is a linear function of the code: p = A·z + b.
export function decode(z, w) {
  if (z.h !== 1 || z.w > MAX_CODE) throw new Error('解码器要接编码（一行数字）')
  const k = z.w
  let px = w[6]
  let py = w[7]
  for (let j = 0; j < k; j++) {
    px += w[j] * z.data[j]
    py += w[3 + j] * z.data[j]
  }
  return blobAt(px, py)
}
// Small fixed pseudo-random starting weights, so training does not start from a symmetric zero.
const seeded = (seed, n, scale) => {
  const next = random(seed)
  return Array.from({ length: n }, () => Math.round((next() - 0.5) * 2 * scale * 1000) / 1000)
}
export const ENCODER_START = seeded(81, 16 * MAX_CODE, 0.3)
export const DECODER_START = [...seeded(82, 6, 0.3), 0, 0]

// Estimate the blob centre in latent units, using only pixels brighter than 0.3.
export function encodeBlobCentre(img) {
  let total = 0
  let sx = 0
  let sy = 0
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const v = Math.max(0, img.data[y * img.w + x] - 0.3)
    total += v
    sx += v * x
    sy += v * y
  }
  return row([(sx / total - 7.5) / UNIT, (sy / total - 7.5) / UNIT])
}
