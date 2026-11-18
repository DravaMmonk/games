/** Estimate a gradient by forward differences, then optionally backtrack along it. */
export function gradientStep(weights, loss, rate, { backtrack = true } = {}) {
  const epsilon = 1e-4
  const base = loss(weights)
  const gradients = weights.map((_, i) => {
    const probe = weights.slice()
    probe[i] += epsilon
    return (loss(probe) - base) / epsilon
  })
  const stepBy = step => weights.map((weight, i) => weight - step * gradients[i])
  if (!backtrack) {
    const next = stepBy(rate)
    return { weights: next, loss: loss(next), rate }
  }
  let step = rate
  for (let attempt = 0; attempt < 8; attempt++, step /= 2) {
    const next = stepBy(step)
    const after = loss(next)
    if (after <= base) return { weights: next, loss: after, rate: step }
  }
  return { weights, loss: base, rate: step }
}
