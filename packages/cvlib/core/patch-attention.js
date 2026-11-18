import { image } from 'imglib'
import { scaledDotProductAttention } from 'mllib'

// Patch tokens for the attention chapter. An image is cut into non-overlapping P×P patches; each patch,
// read row by row, is one token (a vector of P² numbers). Tokens are numbered in reading order.

const PATCH = 4

function tokens(img, P = PATCH) {
  const cols = Math.floor(img.w / P)
  const rows = Math.floor(img.h / P)
  const list = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const vector = new Float64Array(P * P)
      for (let v = 0; v < P; v++) for (let u = 0; u < P; u++) vector[v * P + u] = img.data[(r * P + v) * img.w + c * P + u]
      list.push(vector)
    }
  }
  return { list, cols, rows }
}

function untokens(list, cols, rows, P = PATCH) {
  const out = image(cols * P, rows * P)
  list.forEach((vector, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    for (let v = 0; v < P; v++) for (let u = 0; u < P; u++) out.data[(r * P + v) * out.w + c * P + u] = vector[v * P + u]
  })
  return out
}

/** Apply token attention to non-overlapping patches and reconstruct the image. */
export function patchAttention(Q, K = Q, V = K, s = 1, P = PATCH) {
  const q = tokens(Q, P)
  const k = tokens(K, P).list
  const v = tokens(V, P).list
  const out = scaledDotProductAttention(q.list, k, v, s)
  return untokens(out, q.cols, q.rows, P)
}
