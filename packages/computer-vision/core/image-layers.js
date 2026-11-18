// 3×3 correlation with zero padding, written as one loop because training evaluates it thousands of
// times per step. Same maths as correlate(img, w).
export function conv3(a, w, bias = 0) {
  const { w: W, h: H, data } = a
  const out = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = bias
      for (let v = -1; v <= 1; v++) {
        const yy = y + v
        if (yy < 0 || yy >= H) continue
        for (let u = -1; u <= 1; u++) {
          const xx = x + u
          if (xx >= 0 && xx < W) sum += w[(v + 1) * 3 + u + 1] * data[yy * W + xx]
        }
      }
      out[y * W + x] = sum
    }
  }
  return { w: W, h: H, data: out }
}

export function convRgb(r, g, b, weights) {
  const red = conv3(r, weights.slice(0, 9))
  const green = conv3(g, weights.slice(9, 18))
  const blue = conv3(b, weights.slice(18, 27))
  return { w: r.w, h: r.h, data: red.data.map((v, i) => v + green.data[i] + blue.data[i]) }
}

export function residualConv(input, weights) {
  const filtered = conv3(input, weights)
  return { w: input.w, h: input.h, data: filtered.data.map((v, i) => v + input.data[i]) }
}
