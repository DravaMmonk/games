import { valueText } from 'kernel'
import { T } from 'kernel/words'
import { outputReason } from 'circuit'

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
    why: port => outputReason(port.label, show, (message, { tick }) => T('第 {tick} 拍，{zh}', { tick, zh: message })),
  })
}

export function tickReport(steps, fail) {
  if (!fail) return { ticks: steps }
  return { ticks: steps.map((step) => step.tick === fail.at.tick ? { ...step, failed: fail } : step), fail }
}
