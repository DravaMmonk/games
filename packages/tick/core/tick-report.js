import { valueText } from 'kernel'

export function judgeTicks({ checked, want, got = (tick, id) => tick.outputs[id] ?? null, same = (want, got) => want === got, why }) {
  return (steps) => {
    for (const step of steps) {
      for (const port of checked) {
        const expected = want(port.name)?.[step.tick]
        if (expected === undefined) continue
        const actual = got(step, port.name)
        if (!same(expected, actual)) {
          return { at: { tick: step.tick, id: port.name }, want: expected, got: actual, why: why(port, expected, actual, step.tick) }
        }
      }
    }
    return null
  }
}

export function tickJudge({ show = valueText, ...options }) {
  return judgeTicks({
    ...options,
    why: (port) => ({ relation: 'output', subject: port.label, show }),
  })
}

export function tickReport(steps, fail) {
  if (!fail) return { ticks: steps }
  return { ticks: steps.map((step) => step.tick === fail.at.tick ? { ...step, failed: fail } : step), fail }
}
