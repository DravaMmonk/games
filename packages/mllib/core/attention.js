// Weights of one query over all keys: softmax(s·q·k / √d). They are positive and sum to 1.
export function attentionWeights(q, keys, s = 1) {
  const d = q.length
  const scores = keys.map((k) => {
    let dot = 0
    for (let i = 0; i < d; i++) dot += q[i] * k[i]
    return (s * dot) / Math.sqrt(d)
  })
  const top = Math.max(...scores)
  const e = scores.map((x) => Math.exp(x - top))
  const total = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / total)
}

/** Mix value vectors using scaled query–key scores. Values may have a different width from keys. */
export function scaledDotProductAttention(queries, keys, values, scale = 1) {
  return queries.map(query => {
    const weights = attentionWeights(query, keys, scale)
    const mixed = new Float64Array(values[0]?.length ?? query.length)
    weights.forEach((weight, j) => {
      for (let i = 0; i < mixed.length; i++) mixed[i] += weight * values[j][i]
    })
    return mixed
  })
}
