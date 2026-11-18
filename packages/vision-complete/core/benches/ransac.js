// The RANSAC bench: fit a line to points with outliers by k rounds of drawing 2 points and counting those within δ;
// the player picks δ, and k per outlier ratio, and is judged over many seeded trials.

import { benchRun } from 'image'
import { keyOf } from 'kernel'
import { ransacBench, ransacRounds } from 'cvlib'

/** The bench model: knobs delta (the threshold, shared) and k (rounds, one per case); each case an outlier ratio. */
export const ransac = {
  make({ solution, ...p }, bench) {
    const m = ransacBench(p)
    const caches = bench.cases.map(() => new Map())
    return {
      trials: m.trials,
      trial: m.trial,
      solution,
      view({ k, delta }, { case: example, caseIndex }) {
        const rounds = k[caseIndex]
        const cache = caches[caseIndex]
        const key = `${rounds}:${delta}`
        if (!cache.has(key)) cache.set(key, m.rate(example, rounds, delta))
        return cache.get(key)
      },
    }
  },
  verify(model, bench) {
    const { cases } = bench
    const { solution } = model
    const run = (delta, k) => benchRun(bench, model, { delta, k })
    const passAll = (delta, k) => run(delta, k).pass
    const passesCase = (i, rounds) => run(solution.delta, solution.k.map((k, j) => i === j ? rounds : k)).verdicts[i].pass
    if (!passAll(solution.delta, solution.k)) return `reference δ=${solution.delta}, k=${solution.k} fails`
    for (const [i, stage] of cases.entries()) {
      const theory = ransacRounds(1 - stage.outliers)
      if (theory > stage.budget) return `${keyOf(stage.label)}: formula needs ${theory} rounds, budget ${stage.budget}`
      // Far fewer rounds than the formula asks for must fail.
      if (passesCase(i, Math.ceil(theory / 3))) return `${keyOf(stage.label)}: k = ${Math.ceil(theory / 3)} already passes`
      if (i && passesCase(i, cases[0].budget)) return `${keyOf(stage.label)}: the first stage's k passes, k needs no thought`
    }
    // δ too large lets outliers in; δ too small loses inliers; neither is rescued by the budget.
    const budgets = cases.map((s) => s.budget)
    if (passAll(6, budgets)) return 'δ = 6 passes'
    if (passAll(0.25, budgets)) return 'δ = 0.25 passes'
    if (passAll(2.5, budgets)) return 'δ = 2.5 passes'
    return ''
  },
}
