import { textEntries } from 'kernel'

export const goalKind = 'optimization/goal'
const hasMetrics = (result, rank) => rank.every(({ metric }) =>
  result?.values && Object.hasOwn(result.values, metric) && Number.isFinite(result.values[metric]))

// Compare a single attempt in priority order and keep its measurements together.
function improves(result, previous, rank) {
  if (!hasMetrics(previous, rank)) return true
  for (const { metric, direction } of rank) {
    const next = result.values[metric]
    const best = previous.values[metric]
    if (next !== best) return direction === 'min' ? next < best : next > best
  }
  return false
}

export function optimize(definitions) {
  const goals = Object.entries(definitions)
  return {
    record(best, result) {
      let next = best
      for (const [id, { rank }] of goals) {
        if (hasMetrics(result, rank) && improves(result, best[id], rank)) next = { ...next, [id]: result }
      }
      return next
    },
    summary(best) {
      for (const [id, { rank, label }] of goals) {
        if (hasMetrics(best[id], rank)) return { label, values: best[id].values }
      }
    },
  }
}

export function register(kernel) {
  kernel.kind(goalKind, { type: goalKind, read: value => value })
  kernel.check('optimization/goals', ({ content }) => Object.entries(content.registries?.[goalKind] ?? {}).flatMap(([id, { rank, label }]) => {
    const metrics = new Set(rank.map(({ metric }) => metric))
    const problems = []
    if (metrics.size !== rank.length) problems.push('ranking repeats a metric')
    if ([...metrics].some(metric => !/^[a-z][a-z0-9_]*$/.test(metric))) problems.push('ranking uses an invalid metric name')
    for (const [language, text] of typeof label === 'string' ? [['label', label]] : textEntries(label)) {
      for (const [, metric] of text.matchAll(/\{([^{}]+)\}/g)) {
        if (!metrics.has(metric)) problems.push(`${language} label names unranked metric ${metric}`)
      }
    }
    return problems.map(problem => ({ fail: true, text: `${id}: ${problem}` }))
  }))
}
